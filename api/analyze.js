export const config = { maxDuration: 60 }; // Vercel Hobby max is 60s; upgrade to Pro for up to 300s

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Api-Key');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: '仅支持 POST 请求' });
  }

  const apiKey = req.headers['x-api-key'];
  if (!apiKey || !apiKey.startsWith('sk-')) {
    return res.status(401).json({ error: 'API Key 无效，请填入有效的 DeepSeek Key（sk-...）' });
  }

  let body;
  try {
    body = req.body;
    if (typeof body === 'string') body = JSON.parse(body);
  } catch {
    return res.status(400).json({ error: '请求格式错误' });
  }

  const endpoint = (body.endpoint || '').includes('openrouter')
    ? 'https://openrouter.ai/api/v1/chat/completions'
    : 'https://api.deepseek.com/chat/completions';

  const upstreamBody = {
    model: body.model || 'deepseek-chat',
    max_tokens: Math.min(body.max_tokens || 4000, 4000),
    temperature: body.temperature ?? 0.1,
    messages: body.messages,
  };

  try {
    // AbortController for explicit timeout (give DeepSeek 55s, leaving 5s buffer)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 55000);

    const upstream = await fetch(endpoint, {
      signal: controller.signal,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        ...(endpoint.includes('openrouter') ? {
          'HTTP-Referer': 'https://satzanalysator.vercel.app',
          'X-Title': 'Deutscher Satzanalysator',
        } : {}),
      },
      body: JSON.stringify(upstreamBody),
    });

    clearTimeout(timeoutId);
    const data = await upstream.json();

    if (!upstream.ok) {
      const msg = data?.error?.message || `上游错误 ${upstream.status}`;
      return res.status(upstream.status).json({ error: msg });
    }

    return res.status(200).json(data);
  } catch (e) {
    if (e.name === 'AbortError') {
      return res.status(504).json({ error: '分析超时（DeepSeek 响应时间超过55秒）。建议：①尝试更短的句子 ②稍后重试' });
    }
    return res.status(502).json({ error: '代理请求失败：' + e.message });
  }
}

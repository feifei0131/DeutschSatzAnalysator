export const config = { maxDuration: 60 };

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
    const upstream = await fetch(endpoint, {
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

    const data = await upstream.json();

    if (!upstream.ok) {
      const msg = data?.error?.message || `上游错误 ${upstream.status}`;
      return res.status(upstream.status).json({ error: msg });
    }

    return res.status(200).json(data);
  } catch (e) {
    return res.status(502).json({ error: '代理请求失败：' + e.message });
  }
}

export const config = { runtime: 'edge' };

export default async function handler(req) {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, X-Api-Key',
      },
    });
  }

  if (req.method !== 'POST') {
    return json({ error: '仅支持 POST 请求' }, 405);
  }

  const apiKey = req.headers.get('x-api-key');
  if (!apiKey || !apiKey.startsWith('sk-')) {
    return json({ error: 'API Key 无效，请填入有效的 DeepSeek Key（sk-...）' }, 401);
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return json({ error: '请求格式错误' }, 400);
  }

  // Use non-streaming — but keep Edge runtime so Vercel won't apply Node timeout
  // Edge runtime has no execution time limit on I/O wait, only CPU time
  const upstreamResp = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      max_tokens: Math.min(body.max_tokens || 4000, 4000),
      temperature: body.temperature ?? 0.1,
      messages: body.messages,
      stream: false,
    }),
  });

  // Read full response body as text first to avoid partial JSON
  const rawText = await upstreamResp.text();

  if (!upstreamResp.ok) {
    let errMsg = `上游错误 ${upstreamResp.status}`;
    try {
      const e = JSON.parse(rawText);
      errMsg = e?.error?.message || errMsg;
    } catch {}
    return json({ error: errMsg }, upstreamResp.status);
  }

  // Validate JSON before passing to client
  try {
    JSON.parse(rawText);
  } catch (e) {
    return json({ error: 'DeepSeek 返回格式异常，请重试。(' + e.message.slice(0, 60) + ')' }, 502);
  }

  return new Response(rawText, {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-store',
    },
  });
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  });
}

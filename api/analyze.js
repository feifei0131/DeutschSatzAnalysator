export const config = { runtime: 'edge' };

export default async function handler(req) {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: cors() });
  }
  if (req.method !== 'POST') return err('仅支持 POST 请求', 405);

  const apiKey = req.headers.get('x-api-key');
  if (!apiKey || !apiKey.startsWith('sk-')) return err('API Key 无效', 401);

  let body;
  try { body = await req.json(); } catch { return err('请求格式错误', 400); }

  const upstream = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'deepseek-v4-flash',
      max_tokens: Math.min(body.max_tokens || 4000, 4000),
      temperature: body.temperature ?? 0.1,
      messages: body.messages,
      stream: false,
    }),
  });

  if (!upstream.ok) {
    const t = await upstream.text();
    let msg = `上游错误 ${upstream.status}`;
    try { msg = JSON.parse(t)?.error?.message || msg; } catch {}
    return err(msg, upstream.status);
  }

  const data = await upstream.json();
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { 'Content-Type': 'application/json', ...cors() },
  });
}

function cors() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Api-Key',
  };
}

function err(message, status = 500) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  });
}

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
    return new Response(JSON.stringify({ error: '仅支持 POST 请求' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const apiKey = req.headers.get('x-api-key');
  if (!apiKey || !apiKey.startsWith('sk-')) {
    return new Response(JSON.stringify({ error: 'API Key 无效，请在设置中填入有效的 DeepSeek Key（sk-...）' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: '请求格式错误' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
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
      return new Response(JSON.stringify({ error: msg }), {
        status: upstream.status,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-store',
      },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: '代理请求失败：' + e.message }), {
      status: 502,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }
}

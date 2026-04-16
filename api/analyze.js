// Edge runtime supports streaming and has no timeout on I/O wait
export const config = { runtime: 'edge' };

export default async function handler(req) {
  // CORS preflight
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

  const endpoint = 'https://api.deepseek.com/chat/completions';

  // Stream from DeepSeek, collect full response, then return as JSON
  // Using streaming avoids Vercel Edge's idle-connection timeout
  const upstreamResp = await fetch(endpoint, {
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
      stream: true,          // ← key: stream keeps connection alive
    }),
  });

  if (!upstreamResp.ok) {
    let errMsg = `上游错误 ${upstreamResp.status}`;
    try {
      const e = await upstreamResp.json();
      errMsg = e?.error?.message || errMsg;
    } catch {}
    return json({ error: errMsg }, upstreamResp.status);
  }

  // Transform SSE stream → collect all chunks → return complete JSON
  // This keeps the edge connection alive while DeepSeek streams tokens
  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();
  const encoder = new TextEncoder();

  // Process stream in background
  (async () => {
    const reader = upstreamResp.body.getReader();
    const decoder = new TextDecoder();
    let fullContent = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6).trim();
          if (data === '[DONE]') continue;
          try {
            const parsed = JSON.parse(data);
            const delta = parsed.choices?.[0]?.delta?.content;
            if (delta) fullContent += delta;
          } catch {}
        }
      }

      // Send complete response as JSON
      const responseData = JSON.stringify({
        choices: [{
          message: { role: 'assistant', content: fullContent },
          finish_reason: 'stop',
        }],
      });

      await writer.write(encoder.encode(responseData));
    } catch (e) {
      const errData = JSON.stringify({ error: '流式读取失败：' + e.message });
      await writer.write(encoder.encode(errData));
    } finally {
      await writer.close();
    }
  })();

  return new Response(readable, {
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

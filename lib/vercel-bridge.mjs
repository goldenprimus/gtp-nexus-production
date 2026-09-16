export function asNetlifyEvent(request) {
  return {
    httpMethod: request.method,
    headers: request.headers,
    body: typeof request.body === 'string' ? request.body : JSON.stringify(request.body || {})
  };
}

export function sendNetlifyResult(response, result) {
  for (const [name, value] of Object.entries(result.headers || {})) response.setHeader(name, value);
  return response.status(result.statusCode || 200).send(result.body || '');
}

export async function run(response, handler, request) {
  try {
    return sendNetlifyResult(response, await handler(asNetlifyEvent(request)));
  } catch (error) {
    return response.status(500).json({ error: error.message || 'Server request failed.' });
  }
}

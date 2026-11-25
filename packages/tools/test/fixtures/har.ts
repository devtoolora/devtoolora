const wrap = (entries: unknown[]): string => JSON.stringify({ log: { entries, version: '1.2' } });

export const harBasic = wrap([
  {
    request: { method: 'GET', url: 'https://example.com/index.html' },
    response: {
      content: { mimeType: 'text/html', size: 1024 },
      status: 200,
      statusText: 'OK',
    },
    startedDateTime: '2026-10-27T10:00:00.000Z',
    time: 120,
    timings: { wait: 80 },
  },
  {
    request: { method: 'POST', url: 'https://api.example.com/items' },
    response: {
      bodySize: 512,
      content: { mimeType: 'application/vnd.api+json', size: -1 },
      status: 404,
      statusText: 'Not Found',
    },
    startedDateTime: '2026-10-27T10:00:01.000Z',
    time: 300,
    timings: { wait: 250 },
  },
  {
    _error: 'net::ERR_CONNECTION_REFUSED',
    request: { method: 'GET', url: 'https://example.com/logo.svg' },
    response: { content: { mimeType: 'image/svg+xml' }, status: 0, statusText: '' },
    startedDateTime: '2026-10-27T10:00:02.000Z',
    time: 50,
  },
]);

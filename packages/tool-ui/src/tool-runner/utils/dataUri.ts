export function dataUriByteLength(dataUri: string): number {
  const body = dataUri.slice(dataUri.indexOf(',') + 1);

  return Math.floor((body.length * 3) / 4) - base64Padding(body);
}

function base64Padding(body: string): number {
  if (body.endsWith('==')) return 2;

  return body.endsWith('=') ? 1 : 0;
}

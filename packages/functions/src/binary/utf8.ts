export function bytesToUtf8(bytes: Uint8Array): string {
  return new TextDecoder().decode(bytes);
}

export function utf8Bytes(value: string): Uint8Array {
  return new TextEncoder().encode(value);
}

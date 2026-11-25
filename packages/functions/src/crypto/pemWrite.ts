import { base64Encode } from '../binary';

export function pemEncode(label: string, der: Uint8Array, columns = 64): string {
  const lines = base64Encode(der).match(new RegExp(`.{1,${columns}}`, 'g')) ?? [];

  return [`-----BEGIN ${label}-----`, ...lines, `-----END ${label}-----`, ''].join('\n');
}

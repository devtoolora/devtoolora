import { formatIpv6 } from './ipv6';
import { networkError } from './shared';

export function createMacAddress(): string {
  const bytes = secureRandomBytes(6);

  bytes[0] = ((bytes[0] ?? 0) | 0x02) & 0xfe;

  return [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join(':');
}

function ulaPrefix(): bigint {
  const globalId = [...secureRandomBytes(5)].reduce(
    (total, byte) => (total << 8n) | BigInt(byte),
    0n,
  );

  return (0xfdn << 120n) | (globalId << 80n);
}

export function generateIpv6Ula(): string {
  return `${formatIpv6(ulaPrefix(), 'compressed')}/48`;
}

export interface Ipv6UlaPlan {
  exampleHost: string;
  exampleSubnet: string;
  globalId: string;
  prefix: string;
  subnetCount: number;
}

export function generateIpv6UlaPlan(): Ipv6UlaPlan {
  const site = ulaPrefix();
  const subnet = site | (1n << 64n);

  return {
    exampleHost: formatIpv6(subnet | 1n, 'compressed'),
    exampleSubnet: `${formatIpv6(subnet, 'compressed')}/64`,
    globalId: ((site >> 80n) & 0xffffffffffn).toString(16).padStart(10, '0'),
    prefix: `${formatIpv6(site, 'compressed')}/48`,
    subnetCount: 65536,
  };
}

function secureRandomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length);

  if (!globalThis.crypto?.getRandomValues)
    throw networkError(
      'SECURE_RANDOM_UNAVAILABLE',
      'Secure randomness is unavailable. Use a browser or runtime with crypto.getRandomValues; no weak fallback is used.',
    );

  globalThis.crypto.getRandomValues(bytes);

  return bytes;
}

import { type ConfigOptions, fail, type Plan, planConfig, singleLine } from './wireguardPlan';
import { newPrivateKey, x25519PublicKey } from './wireguardKeys';

export type WireguardOptions = { mode: 'keys'; privateKey: string } | ConfigOptions;

export interface WireguardResult {
  files: Array<{ name: string; text: string }>;
  summary: string;
  text: string;
}

type Random = (length: number) => Uint8Array;

const keyShape = /^[A-Za-z0-9+/]{43}=$/;

const toBase64 = (bytes: Uint8Array): string => btoa(String.fromCharCode(...bytes));

function fromBase64(text: string): Uint8Array | null {
  if (!keyShape.test(text)) return null;

  const bytes = Uint8Array.from(atob(text), (char) => char.charCodeAt(0));

  return toBase64(bytes) === text ? bytes : null;
}

function natRules(tool: string, action: 'A' | 'D', nat: string): string {
  const rules = [
    `${tool} -${action} FORWARD -i %i -j ACCEPT`,
    `${tool} -${action} FORWARD -o %i -j ACCEPT`,
    `${tool} -t nat -${action} POSTROUTING -o ${nat} -j MASQUERADE`,
  ];

  return rules.join('; ');
}

function natLines(plan: Plan): string[] {
  if (plan.nat === '') return [];

  const tools = plan.v6 ? ['iptables', 'ip6tables'] : ['iptables'];
  const rules = (action: 'A' | 'D'): string =>
    tools.map((tool) => natRules(tool, action, plan.nat)).join('; ');

  return [`PostUp = ${rules('A')}`, `PostDown = ${rules('D')}`];
}

interface Peer {
  address: string;
  key: Uint8Array;
  name: string;
  psk: string;
  publicKey: string;
}

const addressList = (v4: string, v6: string | undefined): string =>
  v6 === undefined ? v4 : `${v4}, ${v6}`;

const sectionsText = (sections: string[][]): string =>
  `${sections.map((lines) => lines.join('\n')).join('\n\n')}\n`;

const optionalLine = (name: string, value: string): string[] =>
  value === '' ? [] : [`${name} = ${value}`];

async function newPeer(plan: Plan, index: number, random: Random): Promise<Peer> {
  const key = newPrivateKey(random);
  const v6 = plan.v6?.clientIps[index];

  return {
    address: addressList(`${plan.v4.clientIps[index]}/32`, v6 === undefined ? v6 : `${v6}/128`),
    key,
    name: `client${index + 1}`,
    psk: plan.psk ? toBase64(random(32)) : '',
    publicKey: toBase64(await x25519PublicKey(key)),
  };
}

function serverFile(options: ConfigOptions, plan: Plan, key: Uint8Array, peers: Peer[]): string {
  const v6 = plan.v6;
  const address = addressList(
    `${plan.v4.serverIp}/${plan.v4.prefix}`,
    v6 ? `${v6.serverIp}/${v6.prefix}` : undefined,
  );

  return sectionsText([
    [
      '[Interface]',
      `Address = ${address}`,
      `ListenPort = ${options.listenPort}`,
      `PrivateKey = ${toBase64(key)}`,
      ...natLines(plan),
    ],
    ...peers.map((peer) => [
      '[Peer]',
      `# ${peer.name}`,
      `PublicKey = ${peer.publicKey}`,
      ...optionalLine('PresharedKey', peer.psk),
      `AllowedIPs = ${peer.address}`,
    ]),
  ]);
}

function clientFile(options: ConfigOptions, plan: Plan, serverPublic: string, peer: Peer): string {
  const keepalive = options.keepalive === 0 ? '' : String(options.keepalive);

  return sectionsText([
    [
      '[Interface]',
      `Address = ${peer.address}`,
      `PrivateKey = ${toBase64(peer.key)}`,
      ...optionalLine('DNS', plan.dns),
    ],
    [
      '[Peer]',
      '# Server',
      `PublicKey = ${serverPublic}`,
      ...optionalLine('PresharedKey', peer.psk),
      `Endpoint = ${plan.endpoint}`,
      `AllowedIPs = ${plan.allowedIps}`,
      ...optionalLine('PersistentKeepalive', keepalive),
    ],
  ]);
}

async function writeConfig(options: ConfigOptions, random: Random): Promise<WireguardResult> {
  const plan = planConfig(options);
  const serverKey = newPrivateKey(random);
  const serverPublic = toBase64(await x25519PublicKey(serverKey));
  const peers: Peer[] = [];

  for (let index = 0; index < plan.v4.clientIps.length; index += 1)
    peers.push(await newPeer(plan, index, random));

  return result(options, plan, [
    { name: 'wg0.conf', text: serverFile(options, plan, serverKey, peers) },
    ...peers.map((peer) => ({
      name: `${peer.name}.conf`,
      text: clientFile(options, plan, serverPublic, peer),
    })),
  ]);
}

const tunnelLabels: Record<ConfigOptions['clientAllowedIps'], string> = {
  custom: 'custom AllowedIPs',
  full: 'full tunnel',
  vpn: 'VPN subnet only',
};

function result(
  options: ConfigOptions,
  plan: Plan,
  files: WireguardResult['files'],
): WireguardResult {
  const count = plan.v4.clientIps.length;
  const keys = plan.psk ? 'preshared keys' : 'no preshared keys';

  return {
    files,
    summary: `Server ${plan.v4.serverIp} + ${count} ${count === 1 ? 'client' : 'clients'} · ${tunnelLabels[options.clientAllowedIps]} · ${keys}`,
    text: files.map((file) => `# ===== ${file.name} =====\n${file.text}`).join('\n'),
  };
}

async function writeKeys(raw: string, random: Random): Promise<WireguardResult> {
  const value = singleLine(raw, 'Private key');
  const key = value === '' ? newPrivateKey(random) : fromBase64(value);

  if (key === null)
    throw fail('INVALID_KEY', 'Private key must be 44 Base64 characters (32 bytes).');

  const text = `PrivateKey = ${value === '' ? toBase64(key) : value}\nPublicKey = ${toBase64(await x25519PublicKey(key))}\n`;

  return {
    files: [{ name: 'wireguard-keys.txt', text }],
    summary: `X25519 key pair · ${value === '' ? 'generated' : 'derived from your private key'}`,
    text,
  };
}

export function generateWireguard(
  options: WireguardOptions,
  random: Random = (length) => crypto.getRandomValues(new Uint8Array(length)),
): Promise<WireguardResult> {
  return options.mode === 'keys'
    ? writeKeys(options.privateKey, random)
    : writeConfig(options, random);
}

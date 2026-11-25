import { ToolDefinition, ToolError, type ToolResult } from '@devtoolora/core';
import { generateKeyPair, type KeyPairAlgorithm } from '@devtoolora/functions/crypto';
import { withToolErrorAsync } from '../../../adapters/errors';
import { browserSafeCapabilities, cryptoTextResult, jsonResultValue } from '../shared';

const sizes = [2048, 3072, 4096] as const;
const curves = ['P-256', 'P-384', 'P-521'] as const;

export const keyPairGeneratorTool: ToolDefinition = {
  autoRun: false,
  capabilities: browserSafeCapabilities,
  category: 'Crypto',
  description:
    'Generate an RSA, ECDSA or Ed25519 key pair in your browser and export it as PEM (PKCS#8 and SPKI) or JWK.',
  fields: [
    {
      defaultValue: 'rsa',
      id: 'algorithm',
      label: 'Algorithm',
      options: [
        { label: 'RSA', value: 'rsa' },
        { label: 'ECDSA', value: 'ecdsa' },
        { label: 'Ed25519', value: 'ed25519' },
      ],
      type: 'select',
    },
    {
      defaultValue: '2048',
      id: 'size',
      label: 'RSA key size',
      options: sizes.map((size) => ({ label: `${size} bits`, value: String(size) })),
      type: 'select',
      visibleWhen: { field: 'algorithm', is: ['rsa'] },
    },
    {
      defaultValue: 'P-256',
      id: 'curve',
      label: 'Curve',
      options: curves.map((curve) => ({ label: curve, value: curve })),
      type: 'select',
      visibleWhen: { field: 'algorithm', is: ['ecdsa'] },
    },
    {
      defaultValue: 'pem',
      id: 'format',
      label: 'Format',
      options: [
        { label: 'PEM', value: 'pem' },
        { label: 'JWK', value: 'jwk' },
      ],
      presentation: 'segmented',
      type: 'select',
    },
  ],
  freshResults: true,
  id: 'key-pair-generator',
  inputKind: 'none',
  keywords: ['key pair', 'rsa', 'ecdsa', 'ed25519', 'pem', 'jwk', 'pkcs8', 'spki', 'keygen'],
  name: 'Key Pair Generator',
  outputKind: 'text',
  relatedToolIds: ['pem-key-inspector', 'jwt-parse', 'certificate-inspector'],
  resultActions: ['copy', 'scratch', 'save'],
  run: ({ fields }) => withToolErrorAsync(() => runKeyPair(fields)),
  samples: [
    { fields: { algorithm: 'rsa', format: 'pem', size: '2048' }, label: 'RSA 2048 as PEM' },
    { fields: { algorithm: 'rsa', format: 'jwk', size: '3072' }, label: 'RSA 3072 as JWK' },
    { fields: { algorithm: 'ecdsa', curve: 'P-256', format: 'pem' }, label: 'ECDSA P-256 as PEM' },
    { fields: { algorithm: 'ecdsa', curve: 'P-384', format: 'jwk' }, label: 'ECDSA P-384 as JWK' },
    { fields: { algorithm: 'ed25519', format: 'pem' }, label: 'Ed25519 as PEM' },
    { fields: { algorithm: 'ed25519', format: 'jwk' }, label: 'Ed25519 as JWK' },
  ],
  supportsSelection: false,
};

async function runKeyPair(fields: Record<string, string>): Promise<ToolResult> {
  const format = fields.format || 'pem';

  if (format !== 'pem' && format !== 'jwk') throw new ToolError('Choose PEM or JWK format.');

  const pair = await generateKeyPair(keyPairAlgorithm(fields));
  const summary = `${pair.description} · ${format.toUpperCase()}`;

  return format === 'jwk'
    ? jsonResultValue(
        { privateKey: pair.privateJwk, publicKey: pair.publicJwk },
        summary,
        'key-pair',
      )
    : cryptoTextResult('key-pair', `${pair.privatePem}\n${pair.publicPem}`, summary);
}

function keyPairAlgorithm(fields: Record<string, string>): KeyPairAlgorithm {
  const algorithm = fields.algorithm || 'rsa';

  if (algorithm === 'ed25519') return { kind: 'ed25519' };

  if (algorithm === 'ecdsa') {
    const namedCurve = curves.find((curve) => curve === (fields.curve || 'P-256'));

    if (!namedCurve) throw new ToolError('Choose P-256, P-384 or P-521.');

    return { kind: 'ecdsa', namedCurve };
  }

  if (algorithm === 'rsa') {
    const modulusLength = sizes.find((size) => String(size) === (fields.size || '2048'));

    if (!modulusLength) throw new ToolError('Choose 2048, 3072 or 4096 bits.');

    return { kind: 'rsa', modulusLength };
  }

  throw new ToolError('Choose RSA, ECDSA or Ed25519.');
}

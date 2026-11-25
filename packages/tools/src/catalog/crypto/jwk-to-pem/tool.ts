import { ToolDefinition, ToolError, type ToolResult } from '@devtoolora/core';
import {
  convertJwkToPem,
  convertPemToJwk,
  detectKeyConversionDirection,
  type KeyConversionDirection,
} from '@devtoolora/functions/crypto';
import { encodeBase64Text } from '@devtoolora/functions/encoding';
import { withToolErrorAsync } from '../../../adapters/errors';
import { browserSafeCapabilities, cryptoTextResult, demoLeaf, jsonResultValue } from '../shared';

const rsaPublicJwk =
  '{"kty":"RSA","n":"tuWe086q8srn7KBSDClnz4dAP4jMyLo9wsEhGVdBXLMTw88WqyYWUJfnUNArMZ4b2qhlEtrqt6B1pv-3AYstxXNJRrwXCryCF1g8mdTqh7jDyWQ4x-WikJ-gfoQhr-b8kv0VvA9_4eBFzUgWJLf1ZMwiF9khTVKUa9AYvSBnTySOabt1lFrz4pzcjmwilKOHp10NZ28_piv_d2-vGSDMz2Bxc2MwNhgx-EiSRVt9a7Z6dLQi0ayfNaXmz6mmuikuz8wVTPQS6kK3zA64v-jlOut-Gl4ea0NietgU-hYAq3lSBdIVEE8n7o7AV-LcRNI16mQTW2VUuQb-D8ZbI8P77w","e":"AQAB"}';
const ecPrivateJwk =
  '{"kty":"EC","x":"EmHAXW0GBEF7kslPcZegoInc53wDJxa8aAoNnmi9_AQ","y":"BetQDdAiCPt793gJ065-5W9l82b6i4XCPl4_gxjizLw","crv":"P-256","d":"cohsEnqexoQ65bio5QlfIcqIM3tbLR-xXeGfEHAYX08"}';
const ed25519PublicJwk =
  '{"crv":"Ed25519","x":"-3dvzYuN__h3D6p6xmDnc274k-EyO77jhuIT8frWhqc","kty":"OKP"}';
const jwkSet =
  '{"keys":[{"kty":"EC","x":"roQSFOqdGc-jBiGflV42Y8Q3KZpCqzomW3ph60OnLf8","y":"jkPU9xPEryN6SxO0kzPq8OnRmNcERpNdfEFkBfiVRYY","crv":"P-256","kid":"a"},{"crv":"Ed25519","x":"-3dvzYuN__h3D6p6xmDnc274k-EyO77jhuIT8frWhqc","kty":"OKP","kid":"b"}]}';
const spkiPem =
  '-----BEGIN PUBLIC KEY-----\nMFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEEmHAXW0GBEF7kslPcZegoInc53wD\nJxa8aAoNnmi9/AQF61AN0CII+3v3eAnTrn7lb2XzZvqLhcI+Xj+DGOLMvA==\n-----END PUBLIC KEY-----\n';

const directionLabels: Record<KeyConversionDirection, string> = {
  'jwk-to-pem': 'JWK to PEM',
  'pem-to-jwk': 'PEM to JWK',
};

export const jwkToPemTool: ToolDefinition = {
  autoRun: false,
  capabilities: browserSafeCapabilities,
  category: 'Crypto',
  description:
    'Convert RSA, EC and Ed25519 keys between JWK (or a JWK Set) and PEM in both directions, with the direction detected from the input. Runs locally.',
  fields: [
    {
      defaultValue: 'auto',
      id: 'direction',
      label: 'Direction',
      options: [
        { label: 'Auto-detect', value: 'auto' },
        { label: 'JWK to PEM', value: 'jwk-to-pem' },
        { label: 'PEM to JWK', value: 'pem-to-jwk' },
      ],
      presentation: 'segmented',
      type: 'select',
    },
  ],
  freshResults: true,
  id: 'jwk-to-pem',
  inputKind: 'text',
  inputPresentation: {
    label: 'JWK, JWK Set or PEM key',
    placeholder: 'Paste a JWK, a JWK Set or a PEM key',
  },
  keywords: ['jwk', 'jwks', 'pem', 'pkcs8', 'spki', 'key', 'convert', 'rsa', 'ec', 'ed25519'],
  name: 'JWK ↔ PEM Converter',
  outputKind: 'text',
  relatedToolIds: ['pem-key-inspector', 'jwt-parse', 'key-pair-generator'],
  resultActions: ['copy', 'scratch', 'save'],
  run: ({ fields, text }) => withToolErrorAsync(() => runConversion(text, fields.direction)),
  samples: [
    { fields: { direction: 'jwk-to-pem' }, label: 'RSA public JWK to PEM', text: rsaPublicJwk },
    {
      fields: { direction: 'jwk-to-pem' },
      label: 'EC P-256 private JWK to PEM',
      text: ecPrivateJwk,
    },
    {
      fields: { direction: 'jwk-to-pem' },
      label: 'Ed25519 public JWK to PEM',
      text: ed25519PublicJwk,
    },
    { fields: { direction: 'jwk-to-pem' }, label: 'JWK Set to PEM', text: jwkSet },
    { fields: { direction: 'pem-to-jwk' }, label: 'Public key PEM to JWK', text: spkiPem },
    { fields: { direction: 'pem-to-jwk' }, label: 'Certificate to JWK', text: demoLeaf },
  ],
  sensitiveInput: true,
  supportsSelection: true,
};

export const pemToJwkTool: ToolDefinition = {
  ...jwkToPemTool,
  aliasOf: 'jwk-to-pem',
  description: 'Convert a PEM key or certificate into a JWK, locally in your browser.',
  fields: jwkToPemTool.fields?.map((field) =>
    field.id === 'direction' ? { ...field, defaultValue: 'pem-to-jwk' } : field,
  ),
  id: 'pem-to-jwk',
  name: 'PEM to JWK Converter',
  samples: [...(jwkToPemTool.samples ?? []).slice(4), ...(jwkToPemTool.samples ?? []).slice(0, 4)],
};

async function runConversion(text: string, direction = 'auto'): Promise<ToolResult> {
  if (direction !== 'auto' && direction !== 'jwk-to-pem' && direction !== 'pem-to-jwk')
    throw new ToolError('Choose Auto-detect, JWK to PEM or PEM to JWK.');

  const detected = detectKeyConversionDirection(text);

  if (direction !== 'auto' && direction !== detected)
    throw new ToolError(
      `Input is ${detected === 'pem-to-jwk' ? 'PEM' : 'JWK'}; switch Direction to ${directionLabels[detected]}.`,
    );

  if (detected === 'pem-to-jwk') {
    const { description, jwk } = await convertPemToJwk(text);

    return jsonResultValue(jwk, `${description} · PEM → JWK`, 'key');
  }

  const { keys, text: pem } = await convertJwkToPem(text);
  const kids = keys.flatMap((key) => (key.kid ? [key.kid.slice(0, 64)] : []));
  const summary =
    keys.length === 1
      ? `${keys[0]?.description} · JWK → PEM`
      : `${keys.length} keys · JWK Set → PEM${kids.length > 0 ? ` · kid ${kids.slice(0, 5).join(', ')}${kids.length > 5 ? '…' : ''}` : ''}`;

  return {
    ...cryptoTextResult('key', pem, summary),
    artifact: {
      base64: encodeBase64Text(pem),
      fileName: 'key.pem',
      mimeType: 'application/x-pem-file',
    },
  };
}

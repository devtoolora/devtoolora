import { ToolDefinition } from '@devtoolora/core';
import { inspectPemKey as inspectPemKeyValue } from '@devtoolora/functions/crypto';
import { withToolErrorAsync } from '../../../adapters/errors';
import { encodeBase64Text } from '@devtoolora/functions/encoding';
import { browserSafeCapabilities, jsonResultValue, pemSource } from '../shared';

export const pemKeyInspectorTool: ToolDefinition = {
  id: 'pem-key-inspector',
  name: 'PEM Key Inspector',
  category: 'Crypto',
  description:
    'Identify one PEM key container and public fingerprint without exporting key bytes, decrypting private keys or certifying strength.',
  autoRun: false,
  inputKind: 'text',
  runRequires: [{ anyOf: ['$text', 'keyFile'] }],
  outputKind: 'json',
  supportsSelection: true,
  capabilities: browserSafeCapabilities,
  freshResults: true,
  sensitiveInput: true,
  fields: [
    {
      id: 'keyFile',
      label: 'PEM key file',
      maxBytes: 1024 * 1024,
      type: 'file',
      accept: '.pem,.key,.pub',
    },
  ],
  resultActions: ['copy', 'scratch', 'save'],
  keywords: ['pem', 'public key', 'private key', 'rsa key', 'ec key', 'key fingerprint'],
  relatedToolIds: ['certificate-inspector', 'certificate-chain-analyzer', 'hash'],
  samples: [
    {
      label: 'RSA 2048-bit public key',
      text: '-----BEGIN PUBLIC KEY-----\nMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAkQwjvGx5qRTQ5XpfsRJT\nIATmva0SrRiFreU99cXjBAXQQyCHtVykx2fiD8mJKo13ICS8xcNle0GTcwfhYe6f\nDHvCKzTdD6o7EODwaCqEGhQiztXyOF15nK+NNbviA7IlfIuT0bdV7WQBN76wIL+l\nlKvtAP13y4NTffUlp4b+h2sPhQN7t5QUtKW/YG5CsVxP1CaRpkW6b4gWpxtrIAyJ\ns+MVxQUfjtjl/5h/1J2NcoeILy4DCBl17oDGRNN8RbkyldiSlJAma261NJbanEXN\nhb3J1nZUtcPk8NnlEiUyIBZsyT3KQqdueX5Z97cFF3E7WKl3l0nZOQbuHrm2e1N2\nNwIDAQAB\n-----END PUBLIC KEY-----\n',
    },
  ],
  run: ({ text, fields }) =>
    withToolErrorAsync(async () => {
      return jsonResultValue(
        await inspectPemKeyValue(pemSource(text, fields.keyFile, 'PEM key')),
        'Container metadata only; no decryption or key-strength certification.',
        'pem-key-inspector',
      );
    }),
};

const demoPublicKey = pemKeyInspectorTool.samples?.[0]?.text ?? '';
const demoEcPublicKey =
  '-----BEGIN PUBLIC KEY-----\nMFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAE0xRyHtw59DwNTOgVDtV/6Yufr2+b\n7tiYAt55+4FNkzo/mEblRMBwkcC1894rZmAgjULvVw+hNsPRyi55YkCaxQ==\n-----END PUBLIC KEY-----';

pemKeyInspectorTool.samples = [
  ...(pemKeyInspectorTool.samples ?? []),
  { fields: { keyFile: '' }, label: 'EC public key', text: demoEcPublicKey },
  { fields: { keyFile: '' }, label: 'CRLF public key', text: demoPublicKey.replace(/\n/g, '\r\n') },
  { fields: { keyFile: '' }, label: 'Surrounding key whitespace', text: `\n ${demoPublicKey} \n` },
  {
    fields: { keyFile: `data:text/plain;base64,${encodeBase64Text(demoPublicKey)}` },
    label: 'Public key file fixture',
    text: 'Ignored because the file has precedence',
  },
  {
    fields: { keyFile: '' },
    label: 'EC public key CRLF',
    text: demoEcPublicKey.replace(/\n/g, '\r\n'),
  },
];

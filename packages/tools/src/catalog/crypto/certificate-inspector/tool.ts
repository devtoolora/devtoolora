import { ToolDefinition } from '@devtoolora/core';
import { inspectCertificate as inspectCertificateValue } from '@devtoolora/functions/crypto';
import { withToolErrorAsync } from '../../../adapters/errors';
import { encodeBase64Text } from '@devtoolora/functions/encoding';
import { browserSafeCapabilities, demoLeaf, demoRoot, jsonResultValue, pemSource } from '../shared';

export const certificateInspectorTool: ToolDefinition = {
  id: 'certificate-inspector',
  name: 'Certificate Inspector',
  category: 'Crypto',
  description:
    'Inspect one PEM certificate, its fingerprints and time window without claiming signature, hostname or trust verification.',
  autoRun: false,
  inputKind: 'text',
  runRequires: [{ anyOf: ['$text', 'certificateFile'] }],
  outputKind: 'json',
  supportsSelection: true,
  capabilities: browserSafeCapabilities,
  freshResults: true,
  fields: [
    {
      id: 'certificateFile',
      label: 'PEM certificate file',
      maxBytes: 1024 * 1024,
      type: 'file',
      accept: '.pem,.crt,.cer',
    },
  ],
  resultActions: ['copy', 'scratch', 'save'],
  keywords: ['x509', 'x.509', 'pem', 'tls certificate', 'ssl certificate', 'fingerprint'],
  relatedToolIds: ['certificate-chain-analyzer', 'pem-key-inspector', 'hash'],
  samples: [
    {
      label: 'Local development leaf certificate',
      text: demoLeaf,
    },
  ],
  run: ({ text, fields }) =>
    withToolErrorAsync(async () =>
      jsonResultValue(
        await inspectCertificateValue(pemSource(text, fields.certificateFile, 'Certificate')),
        'Metadata and time window only; trust is not established.',
        'certificate-inspector',
      ),
    ),
};

certificateInspectorTool.samples = [
  ...(certificateInspectorTool.samples ?? []),
  { fields: { certificateFile: '' }, label: 'Root certificate', text: demoRoot },
  {
    fields: { certificateFile: '' },
    label: 'CRLF certificate',
    text: demoLeaf.replace(/\n/g, '\r\n'),
  },
  { fields: { certificateFile: '' }, label: 'Surrounding whitespace', text: `\n ${demoLeaf} \n` },
  {
    fields: { certificateFile: `data:text/plain;base64,${encodeBase64Text(demoLeaf)}` },
    label: 'Certificate file fixture',
    text: 'Ignored because the file has precedence',
  },
  {
    fields: { certificateFile: '' },
    label: 'Compact PEM payload',
    text: demoLeaf.replace(/\n(?=[A-Za-z0-9+/=])/g, ''),
  },
];

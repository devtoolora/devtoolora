import { ToolDefinition } from '@devtoolora/core';
import { analyzeCertificateChain as analyzeCertificateChainValue } from '@devtoolora/functions/crypto';
import { withToolErrorAsync } from '../../../adapters/errors';
import { encodeBase64Text } from '@devtoolora/functions/encoding';
import {
  browserSafeCapabilities,
  demoChain,
  demoLeaf,
  demoRoot,
  jsonResultValue,
  pemSource,
} from '../shared';

export const certificateChainAnalyzerTool: ToolDefinition = {
  id: 'certificate-chain-analyzer',
  name: 'Certificate Chain Analyzer',
  category: 'Crypto',
  description:
    'Analyze up to 32 supplied PEM certificates in order, separating issuer matches, RSA signature results and external trust.',
  autoRun: false,
  inputKind: 'text',
  runRequires: [{ anyOf: ['$text', 'chainFile'] }],
  outputKind: 'json',
  supportsSelection: true,
  capabilities: browserSafeCapabilities,
  freshResults: true,
  fields: [
    {
      id: 'chainFile',
      label: 'PEM certificate bundle',
      maxBytes: 1024 * 1024,
      type: 'file',
      accept: '.pem,.crt,.cer',
    },
  ],
  resultActions: ['copy', 'scratch', 'save'],
  keywords: ['x509 chain', 'certificate bundle', 'pem chain', 'tls chain', 'ssl chain'],
  relatedToolIds: ['certificate-inspector', 'pem-key-inspector'],
  samples: [
    {
      label: 'Leaf + root certificate chain',
      text: demoChain,
    },
  ],
  run: ({ text, fields }) =>
    withToolErrorAsync(async () =>
      jsonResultValue(
        await analyzeCertificateChainValue(pemSource(text, fields.chainFile, 'Certificate')),
        'Supplied-order internal analysis only; trust is not established.',
        'certificate-chain-analyzer',
      ),
    ),
};

certificateChainAnalyzerTool.samples = [
  ...(certificateChainAnalyzerTool.samples ?? []),
  { fields: { chainFile: '' }, label: 'Reversed order', text: `${demoRoot}\n${demoLeaf}` },
  { fields: { chainFile: '' }, label: 'Root only', text: demoRoot },
  { fields: { chainFile: '' }, label: 'Repeated leaf', text: `${demoLeaf}\n${demoLeaf}` },
  { fields: { chainFile: '' }, label: 'CRLF bundle', text: demoChain.replace(/\n/g, '\r\n') },
  {
    fields: { chainFile: `data:text/plain;base64,${encodeBase64Text(demoChain)}` },
    label: 'Chain file fixture',
    text: 'Ignored because the file has precedence',
  },
];

import { ToolDefinition, ToolError, type ToolResult } from '@devtoolora/core';
import { base64Encode } from '@devtoolora/functions/binary';
import { pemEncode } from '@devtoolora/functions/crypto';
import * as pdfFunctions from '@devtoolora/functions/pdf';
import { withToolErrorAsync } from '../../../adapters/errors';
import { browserSafeCapabilities, pdfFiles, pdfMaxBytes } from '../shared';
import { signed } from './sample';

async function inspectSignatures(fields: Record<string, string>): Promise<ToolResult> {
  const [file] = pdfFiles(fields, false);

  if (!file) throw new ToolError('PDF file is required.');

  const result = await withToolErrorAsync(() => pdfFunctions.inspectPdfSignatures(file));
  const name = pdfFunctions.pdfBaseName(file.name);
  const artifacts = result.signerCertificates.flatMap((der, index) =>
    der
      ? [
          {
            base64: base64Encode(new TextEncoder().encode(pemEncode('CERTIFICATE', der))),
            fileName: `${name}-signature-${index + 1}.pem`,
            mimeType: 'application/x-pem-file',
          },
        ]
      : [],
  );
  const text = JSON.stringify(
    {
      ...(result.certification && { certification: result.certification }),
      signatures: result.signatures,
    },
    null,
    2,
  );

  const jsonArtifact = {
    base64: base64Encode(new TextEncoder().encode(text)),
    fileName: `${name}-signatures.json`,
    mimeType: 'application/json;charset=utf-8',
  };

  return {
    ...(result.signatures.length && { artifacts: [...artifacts, jsonArtifact] }),
    language: 'json',
    summary: result.summary,
    text,
  };
}

export const pdfSignatureInspectorTool: ToolDefinition = {
  autoRun: true,
  capabilities: browserSafeCapabilities,
  category: 'Documents & PDF',
  description:
    'List the signature fields of a PDF, who signed, when, the byte range and whether the file changed afterwards, locally. It does not verify signatures.',
  fields: [
    {
      accept: 'application/pdf',
      id: 'pdfs',
      label: 'Signed PDF',
      maxBytes: pdfMaxBytes,
      required: true,
      type: 'file',
    },
  ],
  freshResults: true,
  id: 'pdf-signature-inspector',
  inputKind: 'none',
  keywords: [
    'pdf signature',
    'inspect pdf signature',
    'pdf signer',
    'pdf digital signature',
    'pdf certificate',
    'docmdp',
  ],
  name: 'PDF Signature Inspector',
  outputKind: 'text',
  relatedToolIds: [
    'pdf-form-filler',
    'certificate-inspector',
    'pdf-metadata-editor',
    'pdf-toolkit',
  ],
  resultActions: ['copy', 'save'],
  run: ({ fields }) => inspectSignatures(fields),
  samples: [
    { fields: { ...signed }, label: 'Signed PDF with a DER signature' },
    { fields: { ...signed }, label: 'Who signed and with which certificate' },
    { fields: { ...signed }, label: 'Reason, location and signing time' },
    { fields: { ...signed }, label: 'Byte range and appended bytes' },
    { fields: { ...signed }, label: 'Export the signer certificate' },
    { fields: { ...signed }, label: 'Presence and signer only' },
  ],
  supportsSelection: false,
};

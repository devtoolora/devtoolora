import { ToolDefinition, ToolResult } from '@devtoolora/core';
import * as webFunctions from '@devtoolora/functions/web';
import { browserSafeCapabilities, identityOutput } from '../shared';

export const mimeLookupTool: ToolDefinition = {
  id: 'mime-lookup',
  keywords: ['mime type', 'content-type', 'media type', 'file extension'],
  name: 'MIME Lookup',
  category: 'Web/API',
  description: 'Look up common file extensions and MIME types.',
  samples: [
    { label: 'Browse all bundled mappings', text: '' },
    { label: 'JSON extension', text: '.json' },
    { label: 'JPEG extension aliases', text: 'image/jpeg' },
    { label: 'Content-Type parameters', text: 'application/json; charset=utf-8' },
    { label: 'Filename', text: 'report.PDF' },
    { label: 'URL pathname', text: 'https://example.com/icon.svg?q=png#fragment' },
  ],
  inputKind: 'optionalText',
  outputKind: 'text',
  supportsSelection: true,
  capabilities: browserSafeCapabilities,
  freshResults: true,
  autoRun: true,
  resultActions: ['copy', 'scratch', 'save'],
  relatedToolIds: ['http-headers-parser', 'url-parse'],
  run: ({ text }) => lookupMime(text),
};

function lookupMime(text: string): ToolResult {
  return identityOutput(
    webFunctions.lookupMimeType(text).join('\n'),
    'mime-reference.txt',
    'Bundled extension/type mapping · no file-content sniffing or upload.',
    false,
  );
}

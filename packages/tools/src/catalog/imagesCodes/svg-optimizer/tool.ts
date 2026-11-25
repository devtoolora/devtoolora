import { ToolDefinition, ToolResult } from '@devtoolora/core';
import { base64Encode } from '@devtoolora/functions/binary';
import { optimizeSvg as optimizeSvgSource, withIntrinsicSize } from '@devtoolora/functions/svg';
import { withToolError } from '../../../adapters/errors';
import { browserSafeCapabilities } from '../shared';

export const svgOptimizerTool: ToolDefinition = {
  id: 'svg-optimizer',
  name: 'SVG Optimizer',
  category: 'Images & Codes',
  description:
    'Reduce SVG file size while preserving view boxes, ids, classes and accessibility attributes.',
  inputKind: 'text',
  outputKind: 'text',
  supportsSelection: true,
  capabilities: browserSafeCapabilities,
  freshResults: true,
  resultActions: ['save', 'copy', 'replace', 'insert', 'scratch'],
  keywords: ['minify svg', 'optimize vector', 'svg cleanup'],
  relatedToolIds: ['svg-placeholder', 'qr-code-generator', 'svg-path-editor'],
  samples: [
    {
      label: 'Icon with editor metadata',
      text: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><!-- icon --><metadata>editor data</metadata><path id="mark" class="icon" data-role="logo" aria-label="Mark" d="M 2 2 L 22 22" /></svg>',
    },
    {
      label: 'Multi-path vector graphic',
      text: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><!-- comment --><circle cx="50" cy="50" r="40" fill="#3b82f6"/><path d="M 30 50 L 70 50" stroke="#fff" stroke-width="4"/></svg>',
    },
    {
      label: 'Accessible SVG with title',
      text: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" aria-labelledby="t1"><title id="t1">Checkmark</title><path d="M 6 16 L 14 24 L 26 8" fill="none" stroke="#10b981" stroke-width="3"/></svg>',
    },
    {
      label: 'Grouped elements with namespaces',
      text: '<svg xmlns="http://www.w3.org/2000/svg" xmlns:sketch="http://sketch.com" viewBox="0 0 48 48"><g id="group-1" sketch:type="MSLayerGroup"><rect width="48" height="48" rx="8" fill="#6366f1"/></g></svg>',
    },
    {
      label: 'Rounded badge vector',
      text: '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><!-- badge --><rect x="4" y="4" width="56" height="56" rx="12" fill="#ef4444"/><circle cx="32" cy="32" r="16" fill="#fff"/></svg>',
    },
    {
      label: 'Geometric polygon icon',
      text: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 50 50"><!-- star --><polygon points="25,5 31,18 45,18 34,27 38,40 25,32 12,40 16,27 5,18 19,18" fill="#f59e0b"/></svg>',
    },
  ],
  run: ({ text }) => optimizeSvg(text),
};

function optimizeSvg(text: string): ToolResult {
  const result = withToolError(() => optimizeSvgSource(text));
  const base64 = base64Encode(new TextEncoder().encode(result.svg));

  return {
    text: result.svg,
    language: 'xml',
    summary: `SVG optimized: ${result.originalBytes} to ${result.optimizedBytes} bytes (${result.savingsPercent}% smaller).`,
    previewDataUri: `data:image/svg+xml;base64,${base64Encode(new TextEncoder().encode(withIntrinsicSize(result.svg)))}`,
    artifact: { base64, mimeType: 'image/svg+xml', fileName: 'optimized.svg' },
  };
}

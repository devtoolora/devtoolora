import { ToolError, type ToolDefinition } from '@devtoolora/core';
import { encodeBase64Text } from '@devtoolora/functions/encoding';
import { resolveStackTrace } from '@devtoolora/functions/logs';
import { filesFromField } from '../../../adapters/files';
import { withToolError } from '../../../adapters/errors';
import { browserSafeCapabilities } from '../shared';
import { firefoxTrace, mixedTrace, pairedTrace, sampleMaps, v8Trace } from './sample';

const sample = (label: string, text: string, maps: string, extra: Record<string, string> = {}) => ({
  fields: { context: 'false', maps, output: 'trace', ...extra },
  label,
  text,
});

export const sourceMapResolverTool: ToolDefinition = {
  autoRun: true,
  capabilities: browserSafeCapabilities,
  category: 'Logs & Diagnostics',
  description:
    'Rewrite a minified stack trace to original files and lines with the .map files of your build.',
  fields: [
    {
      accept: '.map,application/json',
      id: 'maps',
      label: 'Source maps',
      maxBytes: 50 * 1024 * 1024,
      multiple: true,
      required: true,
      type: 'file',
    },
    {
      defaultValue: 'false',
      id: 'context',
      label: 'Show original source lines',
      type: 'checkbox',
    },
    {
      defaultValue: 'trace',
      id: 'output',
      label: 'Output',
      options: [
        { label: 'Trace', value: 'trace' },
        { label: 'JSON', value: 'json' },
      ],
      presentation: 'segmented',
      type: 'select',
    },
  ],
  freshResults: true,
  id: 'source-map-resolver',
  inputKind: 'text',
  keywords: [
    'source map',
    'sourcemap',
    '.map file',
    'minified stack trace',
    'deobfuscate stack',
    'vlq',
  ],
  name: 'Source Map Resolver',
  outputKind: 'text',
  relatedToolIds: ['stack-trace-cleaner', 'log-filter', 'raw-log-redactor'],
  resultActions: ['copy', 'scratch', 'save'],
  run: ({ fields, text }) => {
    const output = fields.output ?? 'trace';

    if (output !== 'trace' && output !== 'json') throw new ToolError('Choose Trace or JSON.');

    const files = filesFromField(fields.maps, 'Source maps');
    const { report, summary, trace } = withToolError(() =>
      resolveStackTrace(text, files, { context: fields.context === 'true' }),
    );
    const json = JSON.stringify(report, null, 2);
    const traceArtifact = {
      base64: encodeBase64Text(trace),
      fileName: 'resolved-trace.txt',
      mimeType: 'text/plain;charset=utf-8',
    };
    const jsonArtifact = {
      base64: encodeBase64Text(json),
      fileName: 'source-map-report.json',
      mimeType: 'application/json;charset=utf-8',
    };

    return {
      artifact: output === 'json' ? jsonArtifact : traceArtifact,
      artifacts: [output === 'json' ? traceArtifact : jsonArtifact],
      language: output === 'json' ? 'json' : 'plaintext',
      summary,
      text: output === 'json' ? json : trace,
    };
  },
  samples: [
    sample('V8 trace from a CDN bundle', v8Trace, sampleMaps.app),
    sample('Firefox trace', firefoxTrace, sampleMaps.app),
    sample('With original source lines', v8Trace, sampleMaps.context, { context: 'true' }),
    sample('Two maps and a vendor frame', mixedTrace, sampleMaps.two),
    sample('One map for a renamed bundle', pairedTrace, sampleMaps.pair),
    sample('JSON report', v8Trace, sampleMaps.app, { output: 'json' }),
  ],
  sensitiveInput: true,
  supportsSelection: true,
};

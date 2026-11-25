import { ToolDefinition, type ToolResult } from '@devtoolora/core';
import { base64Encode } from '@devtoolora/functions/binary';
import { lookupColorNames, swatchStripSvg } from '@devtoolora/functions/color';
import { withToolError } from '../../../adapters/errors';
import { cssGeneratorDefaults } from '../shared';

function runLookup(text: string): ToolResult {
  const lookup = withToolError(() => lookupColorNames(text));
  const rows = lookup.kind === 'name' ? lookup.matches : [...lookup.exact, ...lookup.nearest];
  const table = rows.map((match) => [
    match.name,
    match.hex,
    lookup.kind === 'name' ? '—' : String(match.deltaE),
  ]);
  const output = table.map((row) => row.join('\t')).join('\n');
  const exactCount = lookup.kind === 'color' ? lookup.exact.length : 0;
  const svg = swatchStripSvg(
    rows.map((match, index) => ({
      color: match.hex,
      detail: match.hex,
      label: match.name,
      marked: index < exactCount,
    })),
  );
  const notes =
    lookup.kind === 'color' && lookup.alphaIgnored ? '\n\nAlpha was ignored for the lookup.' : '';
  const found =
    exactCount > 0
      ? `Exact match: ${rows
          .slice(0, exactCount)
          .map((match) => match.name)
          .join(', ')}.`
      : `No exact name. Nearest is ${rows[0]?.name ?? 'none'}.`;
  const summary =
    lookup.kind === 'name'
      ? `${rows.length} CSS named ${rows.length === 1 ? 'color matches' : 'colors match'}.`
      : found;

  return {
    jsonTable: { columns: ['Name', 'Hex', 'ΔE'], presentation: 'plain', rows: table },
    previewDataUri: `data:image/svg+xml;base64,${base64Encode(new TextEncoder().encode(svg))}`,
    summary: `${summary}${notes}`,
    text: output,
  };
}

const sample = (label: string, text: string) => ({ fields: {}, label, text });

export const colorNameLookupTool: ToolDefinition = {
  ...cssGeneratorDefaults,
  description:
    'Find the CSS named colors for a color or a name fragment, with the 5 closest names by OKLab distance.',
  fields: [],
  id: 'color-name-lookup',
  inputKind: 'text',
  inputPresentation: { label: 'Color or name', placeholder: '#6495ed, rgb(100 149 237) or slate' },
  keywords: ['named colors', 'css color names', 'nearest color', 'x11', 'color name'],
  name: 'CSS Color Name Lookup',
  relatedToolIds: ['color-mixer', 'color-scale-generator'],
  run: ({ text }) => runLookup(text),
  samples: [
    sample('Aqua and cyan', '#00ffff'),
    sample('Rebecca purple', '#663399'),
    sample('Near cornflower blue', '#6495ec'),
    sample('Names with slate', 'slate'),
    sample('Spaced fragment', 'Light Slate'),
    sample('Color with alpha', 'rgb(255 99 71 / 0.5)'),
  ],
};

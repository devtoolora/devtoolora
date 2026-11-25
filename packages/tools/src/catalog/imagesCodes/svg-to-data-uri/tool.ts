import { ToolDefinition, ToolError, type ToolField, type ToolResult } from '@devtoolora/core';
import { assertSafeSvg, optimizeSvg, svgDataUri, svgToJsx } from '@devtoolora/functions/svg';
import { withToolError } from '../../../adapters/errors';
import { choiceField } from '../../../adapters/fields';
import { browserSafeCapabilities } from '../shared';

const outputs = ['data-uri', 'css', 'jsx'] as const;
const encodings = ['url', 'base64'] as const;
const inputLimit = 500_000;

type SvgOutput = (typeof outputs)[number];

const svgFields = (defaultOutput: SvgOutput): ToolField[] => [
  {
    defaultValue: defaultOutput,
    id: 'output',
    label: 'Output',
    options: [
      { label: 'Data URI', value: 'data-uri' },
      { label: 'CSS', value: 'css' },
      { label: 'JSX', value: 'jsx' },
    ],
    presentation: 'segmented',
    type: 'select',
  },
  {
    defaultValue: 'url',
    id: 'encoding',
    label: 'Encoding',
    options: [
      { label: 'URL-encoded', value: 'url' },
      { label: 'Base64', value: 'base64' },
    ],
    type: 'select',
    visibleWhen: { field: 'output', isNot: ['jsx'] },
  },
  { defaultValue: 'true', id: 'optimize', label: 'Optimize first', type: 'checkbox' },
  {
    defaultValue: 'Icon',
    help: 'PascalCase, for example Icon or ArrowLeft.',
    id: 'componentName',
    label: 'Component name',
    placeholder: 'Icon',
    type: 'text',
    visibleWhen: { field: 'output', is: ['jsx'] },
  },
  {
    defaultValue: 'false',
    id: 'typescript',
    label: 'TypeScript',
    type: 'checkbox',
    visibleWhen: { field: 'output', is: ['jsx'] },
  },
];

function prepareSvg(text: string, optimize: boolean) {
  if (text.length > inputLimit) throw new ToolError('SVG input is limited to 500,000 characters.');

  const document = withToolError(() => assertSafeSvg(text));

  if (!optimize) return { document, saved: '', svg: text.trim() };

  const optimized = withToolError(() => optimizeSvg(text));
  const savedBytes = optimized.originalBytes - optimized.optimizedBytes;

  return {
    // Re-parse so the JSX matches the optimized markup exactly.
    document: withToolError(() => assertSafeSvg(optimized.svg)),
    saved: savedBytes > 0 ? ` Optimize saved ${savedBytes.toLocaleString('en-US')} bytes.` : '',
    svg: optimized.svg,
  };
}

function jsxResult(values: Record<string, string>, prepared: ReturnType<typeof prepareSvg>) {
  const componentName = values.componentName ?? 'Icon';

  if (!/^[A-Z][A-Za-z0-9]*$/.test(componentName)) {
    throw new ToolError(
      'Component name must start with an uppercase letter and use only letters and digits.',
    );
  }

  const typescript = values.typescript === 'true';

  return {
    language: typescript ? 'typescript' : 'javascript',
    summary: `${typescript ? 'TSX' : 'JSX'} component ${componentName}.${prepared.saved}`,
    text: withToolError(() => svgToJsx(prepared.document, { componentName, typescript })),
  };
}

/** A viewBox-only icon would stretch to the panel, so the preview gets its viewBox size. */
function previewSvg({ document, svg }: ReturnType<typeof prepareSvg>): string {
  const attributes = document.root?.attributes ?? {};
  const [, , width = NaN, height = NaN] = (attributes.viewBox ?? '').split(/[\s,]+/).map(Number);

  if (attributes.width || attributes.height || !(width > 0 && height > 0)) return svg;

  // shortcut: a "<svg" inside a comment before the root would get the size; harmless in an <img>.
  return svg.replace(/<svg(?=[\s>/])/, `<svg width="${width}" height="${height}"`);
}

function convertSvg(
  text: string,
  values: Record<string, string>,
  defaultOutput: SvgOutput,
): ToolResult {
  const output = choiceField(
    values.output,
    defaultOutput,
    outputs,
    'Output must be one of: data-uri, css, jsx.',
  );
  const encoding = choiceField(
    values.encoding,
    'url',
    encodings,
    'Encoding must be one of: url, base64.',
  );
  const prepared = prepareSvg(text, values.optimize !== 'false');
  const previewDataUri = svgDataUri(previewSvg(prepared), 'base64');

  if (output === 'jsx') return { ...jsxResult(values, prepared), previewDataUri };

  const uri = svgDataUri(prepared.svg, encoding);
  const summary = `${encoding === 'url' ? 'URL-encoded' : 'Base64'} data URI, ${uri.length.toLocaleString('en-US')} characters.${prepared.saved}`;

  return output === 'css'
    ? {
        language: 'css',
        previewDataUri,
        summary,
        text: `.icon {\n  background-image: url("${uri}");\n  background-repeat: no-repeat;\n  background-size: contain;\n}`,
      }
    : { language: 'plaintext', previewDataUri, summary, text: uri };
}

const icon = (body: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">\n  ${body}\n</svg>`;
// Every sample names its output, so the aliases (which default to jsx or css) show the same result.
const sample = (label: string, text: string, fields: Record<string, string>) => ({
  fields,
  label,
  text,
});

export const svgToDataUriTool: ToolDefinition = {
  autoRun: true,
  capabilities: browserSafeCapabilities,
  category: 'Images & Codes',
  description:
    'Turn SVG markup into a data URI, a CSS background rule or a React JSX component, and reject SVG that can run script.',
  fields: svgFields('data-uri'),
  freshResults: true,
  id: 'svg-to-data-uri',
  inputKind: 'text',
  inputPresentation: { label: 'SVG', placeholder: 'Paste SVG markup, starting with <svg' },
  keywords: ['svg data url', 'svg css background', 'svg to react', 'inline svg'],
  name: 'SVG to Data URI, CSS & JSX',
  outputKind: 'text',
  relatedToolIds: ['svg-optimizer', 'svg-to-png', 'svg-pattern-generator', 'svg-path-editor'],
  resultActions: ['copy', 'replace', 'insert', 'scratch'],
  run: ({ fields, text }) => convertSvg(text, fields, 'data-uri'),
  samples: [
    sample('Check icon data URI', icon('<path d="M5 12l5 5L20 7"/>'), { output: 'data-uri' }),
    sample('Arrow as CSS background', icon('<path d="M5 12h14M13 6l6 6-6 6"/>'), {
      output: 'css',
    }),
    sample('Base64 circle', icon('<circle cx="12" cy="12" r="9"/>'), {
      encoding: 'base64',
      output: 'data-uri',
    }),
    sample(
      'Styled icon as JSX',
      icon('<path class="a" style="stroke-linecap: round" d="M4 4l16 16"/>'),
      {
        componentName: 'CrossIcon',
        output: 'jsx',
      },
    ),
    sample(
      'Text with tspans as TSX',
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 30"><text x="0" y="20"><tspan font-weight="bold">Dev</tspan> <tspan>Tools</tspan></text></svg>',
      { componentName: 'Logo', output: 'jsx', typescript: 'true' },
    ),
    sample(
      'Unoptimized source',
      icon('<!-- grid -->\n  <rect x="3.0" y="3.0" width="18.0" height="18.0"/>'),
      {
        optimize: 'false',
        output: 'data-uri',
      },
    ),
  ],
  supportsSelection: true,
};

export const svgToJsxTool: ToolDefinition = {
  ...svgToDataUriTool,
  aliasOf: 'svg-to-data-uri',
  description:
    'Convert SVG markup into a React component with className, camelCase attributes and a style object.',
  fields: svgFields('jsx'),
  id: 'svg-to-jsx',
  name: 'SVG to JSX',
  run: ({ fields, text }) => convertSvg(text, fields, 'jsx'),
};

export const svgToCssBackgroundTool: ToolDefinition = {
  ...svgToDataUriTool,
  aliasOf: 'svg-to-data-uri',
  description:
    'Convert SVG markup into a CSS background-image rule with a URL-encoded or Base64 data URI.',
  fields: svgFields('css'),
  id: 'svg-to-css-background',
  name: 'SVG to CSS Background',
  run: ({ fields, text }) => convertSvg(text, fields, 'css'),
};

import { ToolDefinition, ToolError, ToolPreviewKind, ToolResult } from '@devtoolora/core';
import * as cssFunctions from '@devtoolora/functions/css';
import { withToolError } from '../../adapters/errors';
import { numericField } from '../../adapters/fields';
import { encodeBase64Text } from '@devtoolora/functions/encoding';

export const browserSafeCapabilities: ToolDefinition['capabilities'] = [
  'browserWorker',
  'browserMain',
  'vscode',
  'desktop',
];

export type CssGeneratorKind =
  'grid' | 'flexbox' | 'shadow' | 'radius' | 'triangle' | 'clip-path' | 'keyframes';

const cssPreviewKinds: Record<CssGeneratorKind, ToolPreviewKind> = {
  'clip-path': 'css-clip-path',
  flexbox: 'css-flexbox',
  grid: 'css-grid',
  keyframes: 'css-animation',
  radius: 'css-radius',
  shadow: 'css-shadow',
  triangle: 'css-triangle',
};

export interface CssToolConfig {
  description: string;
  fields: ToolDefinition['fields'];
  id: string;
  keywords: string[];
  kind: CssGeneratorKind;
  name: string;
  relatedToolIds: string[];
  samples?: ToolDefinition['samples'];
}

export const cssGeneratorDefaults: Pick<
  ToolDefinition,
  | 'autoRun'
  | 'capabilities'
  | 'category'
  | 'freshResults'
  | 'inputKind'
  | 'outputKind'
  | 'resultActions'
  | 'supportsSelection'
> = {
  autoRun: true,
  capabilities: browserSafeCapabilities,
  category: 'CSS & Design',
  freshResults: true,
  inputKind: 'none',
  outputKind: 'text',
  resultActions: ['copy', 'scratch', 'save'],
  supportsSelection: false,
};

export function cssToolResult({
  css,
  fields,
  fileName,
  kind,
  summary,
}: {
  css: string;
  fields: Record<string, string>;
  fileName: string;
  kind: string;
  summary: string;
}): ToolResult {
  const audit = JSON.stringify({ css, fields, kind }, null, 2);

  return {
    artifact: { base64: encodeBase64Text(css), fileName, mimeType: 'text/css;charset=utf-8' },
    artifacts: [
      {
        base64: encodeBase64Text(audit),
        fileName: `css-${kind}-report.json`,
        mimeType: 'application/json;charset=utf-8',
      },
    ],
    language: 'css',
    summary,
    text: css,
  };
}

export function calculatorResult(
  text: string,
  fileName: string,
  summary: string,
  language: 'css' | 'plaintext',
): ToolResult {
  return {
    artifact: {
      base64: encodeBase64Text(text),
      fileName,
      mimeType: `text/${language === 'css' ? 'css' : 'plain'};charset=utf-8`,
    },
    language,
    summary,
    text,
  };
}

export const createCssTool = ({
  description,
  id,
  keywords,
  name,
  kind,
  fields,
  relatedToolIds,
  samples,
}: CssToolConfig): ToolDefinition => ({
  ...cssGeneratorDefaults,
  id,
  keywords,
  name,
  description,
  preview: cssPreviewKinds[kind],
  fields: fields?.map((field) =>
    id === 'css-flexbox-generator' && field.id === 'direction' && field.type === 'select'
      ? {
          ...field,
          options: [
            ...field.options,
            { label: 'Row reverse', value: 'row-reverse' },
            { label: 'Column reverse', value: 'column-reverse' },
          ],
        }
      : field,
  ),
  samples: samples ?? [],
  relatedToolIds,
  run: ({ fields: values }) => createCss(kind, values),
});

function gridCss(fields: Record<string, string>): string {
  return cssFunctions.generateGridCss({
    columns: numericField(fields.columns, 'Columns', 1, 12, 3),
    rows: numericField(fields.rows, 'Rows', 1, 8, 2),
    columnGap: numericField(fields.columnGap, 'Column gap', 0, 96, 16),
    rowGap: numericField(fields.rowGap, 'Row gap', 0, 96, 16),
    minTrack: numericField(fields.minTrack, 'Minimum track', 40, 600, 120),
    autoFlow: fields.autoFlow ?? 'row',
    justifyItems: fields.justifyItems ?? 'stretch',
    alignItems: fields.alignItems ?? 'stretch',
    justifyContent: fields.justifyContent ?? 'stretch',
    alignContent: fields.alignContent ?? 'stretch',
  });
}

function flexboxCss(fields: Record<string, string>): string {
  return cssFunctions.generateFlexboxCss({
    direction: fields.direction ?? 'row',
    wrap: fields.wrap ?? 'nowrap',
    justify: fields.justify ?? 'center',
    align: fields.align ?? 'center',
    alignContent: fields.alignContent ?? 'stretch',
    gap: numericField(fields.gap, 'Gap', 0, 96, 16),
    grow: numericField(fields.grow, 'Featured item grow', 0, 12, 0, 2),
    shrink: numericField(fields.shrink, 'Featured item shrink', 0, 12, 1, 2),
    basis: numericField(fields.basis, 'Featured item basis', 0, 800, 120),
    order: numericField(fields.order, 'Featured item order', -12, 12, 0),
  });
}

function keyframesCss(fields: Record<string, string>): string {
  return cssFunctions.generateKeyframesCss({
    name: fields.name ?? 'fade-in',
    preset: fields.preset ?? 'fade-up',
    distance: numericField(fields.distance, 'Distance', -200, 200, 16),
    scale: numericField(fields.scale, 'Scale', 1, 200, 90),
    opacity: numericField(fields.opacity, 'Opacity', 0, 100, 0),
    duration: numericField(fields.duration, 'Duration', 100, 10000, 600),
    delay: numericField(fields.delay, 'Delay', 0, 10000, 0),
    iterations: fields.iterations ?? '1',
    direction: fields.direction ?? 'normal',
    fillMode: fields.fillMode ?? 'both',
    easing: fields.easing ?? 'ease-out',
  });
}

function generateCss(kind: CssGeneratorKind, fields: Record<string, string>): string {
  switch (kind) {
    case 'grid':
      return gridCss(fields);
    case 'flexbox':
      return flexboxCss(fields);
    case 'shadow':
      return cssFunctions.generateShadowCss(parseShadowLayers(fields.layers));
    case 'radius':
      if (fields.linked !== undefined && fields.linked !== 'true' && fields.linked !== 'false')
        throw new ToolError('Link corners must be true or false.');

      return cssFunctions.generateRadiusCss(
        numericField(fields.topLeft, 'Top left radius', 0, 200, 16),
        numericField(fields.topRight, 'Top right radius', 0, 200, 16),
        numericField(fields.bottomRight, 'Bottom right radius', 0, 200, 16),
        numericField(fields.bottomLeft, 'Bottom left radius', 0, 200, 16),
      );
    case 'triangle':
      return cssFunctions.generateTriangleCss(
        numericField(fields.size, 'Size', 1, 200, 48),
        fields.direction ?? 'up',
        fields.color ?? '#2563eb',
      );
    case 'clip-path':
      if (fields.webkit !== undefined && fields.webkit !== 'true' && fields.webkit !== 'false')
        throw new ToolError('Add -webkit- prefix must be true or false.');

      return cssFunctions.generateClipShapeCss(cssFunctions.clipShapeFromFields(fields), {
        webkit: fields.webkit === 'true',
      });
    case 'keyframes':
      return keyframesCss(fields);
  }
}

function createCss(kind: CssGeneratorKind, fields: Record<string, string>): ToolResult {
  const css = withToolError(() => generateCss(kind, fields));
  const fileName = cssFileNames[kind] ?? `${kind}.css`;

  return cssToolResult({ css, fields, fileName, kind, summary: cssSummary(kind, fields) });
}

const cssFileNames: Partial<Record<CssGeneratorKind, string>> = {
  radius: 'border-radius.css',
  shadow: 'box-shadow.css',
};

const cssSummaries: Record<Exclude<CssGeneratorKind, 'clip-path'>, string> = {
  flexbox:
    'Container and .item--featured rules generated. Search is the featured preview item. Visual reordering does not change DOM/reading order.',
  grid: 'Fixed-count equal-column grid. Minimum track widths can overflow; rows have an 80px minimum. Preview cell decoration is not exported.',
  keyframes:
    'Validated keyframes and animation rule. Preview controls are not exported; add application-appropriate reduced-motion handling.',
  radius:
    'Corner order: top-left, top-right, bottom-right, bottom-left. Browser radius normalization depends on box dimensions; preview dimensions are not exported.',
  shadow:
    'Shadow layers generated in front-to-back order. Color opacity is preserved. Preview card surface and radius are not exported.',
  triangle:
    'Border triangle: base = twice Size, height = Size (axes swap for left/right). Only decorative CSS is exported; provide accessible markup when meaningful.',
};

function cssSummary(kind: CssGeneratorKind, fields: Record<string, string>): string {
  if (kind === 'keyframes' && fields.preset === 'pulse' && Number(fields.scale ?? 90) <= 100)
    return `Pulse needs a Scale from above 100%. At this value both keyframes are scale(1), so nothing animates. ${cssSummaries.keyframes}`;
  if (kind !== 'clip-path') return cssSummaries[kind];

  const shape =
    ({ circle: 'Circle', ellipse: 'Ellipse', inset: 'Inset' } as Record<string, string>)[
      fields.shape ?? ''
    ] ?? 'Polygon';

  return `${shape} clip-path generated. Positions are percentages of the element box; the preview image, surface and dimensions are not exported. No pixels or files are cropped.`;
}

function parseShadowLayers(value: string | undefined): cssFunctions.ShadowLayer[] {
  return cssFunctions.parseShadowLayers(
    value ?? '[{"x":0,"y":12,"blur":28,"spread":0,"color":"rgba(15, 23, 42, 0.18)","inset":false}]',
  );
}

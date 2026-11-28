import { FunctionError } from '../errors';
import { splitSvgProlog } from './shared';
import { editorPrefixes, isEditorName } from './svgSafety';
import { svgTokens } from './tokens';

const numericAttributes = new Set([
  'cx',
  'cy',
  'd',
  'dx',
  'dy',
  'font-size',
  'fr',
  'fx',
  'fy',
  'gradientTransform',
  'height',
  'letter-spacing',
  'markerHeight',
  'markerWidth',
  'offset',
  'opacity',
  'fill-opacity',
  'pathLength',
  'patternTransform',
  'points',
  'r',
  'refX',
  'refY',
  'rx',
  'ry',
  'stdDeviation',
  'stop-opacity',
  'stroke-dasharray',
  'stroke-dashoffset',
  'stroke-miterlimit',
  'stroke-opacity',
  'stroke-width',
  'transform',
  'viewBox',
  'width',
  'word-spacing',
  'x',
  'x1',
  'x2',
  'y',
  'y1',
  'y2',
]);
const textElements = new Set(['foreignObject', 'script', 'style', 'text', 'textPath', 'tspan']);

export function optimizeSvg(sourceText: string): {
  optimizedBytes: number;
  originalBytes: number;
  savingsPercent: number;
  svg: string;
} {
  const root = splitSvgProlog(sourceText);

  if (!root) throw new FunctionError('INVALID_SVG', 'Paste valid SVG markup starting with <svg>.');

  const declarations = [
    ...root.body.matchAll(/xmlns:([\w.-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g),
  ].map((match): [string, string] => [match[1]!, match[2] ?? match[3] ?? '']);
  const svg = minifySvgTokens(root, editorPrefixes(declarations));
  const originalBytes = utf8Length(sourceText);
  const optimizedBytes = utf8Length(svg);

  return {
    svg,
    originalBytes,
    optimizedBytes,
    savingsPercent: savingsPercent(originalBytes, optimizedBytes),
  };
}

function minifySvgTokens(
  root: NonNullable<ReturnType<typeof splitSvgProlog>>,
  editor: Set<string>,
): string {
  const output: string[] = root.doctype ? [root.doctype] : [];
  const open: Array<{ name: string; preserve: boolean }> = [];
  let metadataDepth = 0;

  const addText = (text: string) => {
    if (!text || metadataDepth > 0) return;
    if (/^\s*$/.test(text) && !open.at(-1)?.preserve) return;

    output.push(text);
  };

  let last = 0;

  for (const { index, text: token } of svgTokens(root.body)) {
    addText(root.body.slice(last, index));
    last = index + token.length;

    if (token.startsWith('<!--')) continue;

    const name = /^<\/?([^\s/>]+)/.exec(token)?.[1] ?? '';
    const isMetadata =
      /^metadata$/i.test(name) || (/^[\w.-]+:[\w.-]+$/.test(name) && isEditorName(name, editor));

    if (token.startsWith('</')) {
      if (metadataDepth > 0) {
        if (isMetadata) metadataDepth -= 1;

        continue;
      }

      open.pop();
      output.push(`</${name}>`);

      continue;
    }

    if (token.startsWith('<![CDATA[') || token.startsWith('<?') || token.startsWith('<!')) {
      if (metadataDepth === 0) output.push(token);

      continue;
    }

    const selfClosing = /\/\s*>$/.test(token);

    if (metadataDepth > 0 || isMetadata) {
      if (isMetadata && !selfClosing) metadataDepth += 1;

      continue;
    }

    output.push(cleanSvgTag(token, editor));
    if (!selfClosing)
      open.push({
        name,
        // Only text content paints whitespace, so xml:space on the root keeps no indentation.
        preserve: Boolean(open.at(-1)?.preserve) || textElements.has(name),
      });
  }

  addText(root.body.slice(last));

  return output.join('');
}

function savingsPercent(originalBytes: number, optimizedBytes: number): number {
  return originalBytes
    ? Math.max(0, Math.round(((originalBytes - optimizedBytes) / originalBytes) * 100))
    : 0;
}

function utf8Length(value: string): number {
  return new TextEncoder().encode(value).length;
}

function cleanSvgTag(tag: string, editor: Set<string>): string {
  const parts = splitTag(tag);

  if (!parts) return tag;

  const { name, rest, selfClosing } = parts;
  const attributes: string[] = [];
  const attribute = /\s*([^\s=]+)(?:\s*=\s*("[^"]*"|'[^']*'))?/y;

  for (let index = 0; rest.slice(index).trim(); index = attribute.lastIndex) {
    attribute.lastIndex = index;
    const found = attribute.exec(rest);

    if (!found) return tag;

    const key = found[1]!;
    const value = found[2];

    if (isEditorName(key, editor)) continue;

    attributes.push(
      value === undefined
        ? key
        : `${key}=${numericAttributes.has(key) ? trimNumbers(value) : value}`,
    );
  }

  return `<${name}${attributes.map((item) => ` ${item}`).join('')}${selfClosing}>`;
}

/**
 * Splits a tag the way /^<([^\s/>]+)([\s\S]*?)(\/?)\s*>$/ does, without retrying the trailing
 * whitespace from every character of a long tag: the lazy middle stops before the trailing
 * whitespace and one "/" in front of it.
 */
function splitTag(tag: string): { name: string; rest: string; selfClosing: string } | undefined {
  const name = /^<([^\s/>]+)/.exec(tag)?.[1];

  if (name === undefined || !tag.endsWith('>')) return undefined;

  const body = tag.slice(name.length + 1, -1).trimEnd();
  const selfClosing = body.endsWith('/') ? '/' : '';

  return { name, rest: body.slice(0, body.length - selfClosing.length), selfClosing };
}

function trimNumbers(quoted: string): string {
  const quote = quoted[0];
  const value = quoted
    .slice(1, -1)
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/(?<![\d.])(-?\d+)\.0+(?![\d.])/g, '$1')
    .replace(/(?<![\d.])(-?\d+\.\d*?[1-9])0+(?![\d.])/g, '$1');

  return `${quote}${value}${quote}`;
}

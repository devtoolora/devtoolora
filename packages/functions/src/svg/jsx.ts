import { XmlComment, XmlElement, XmlText } from '@rgrove/parse-xml';
import type { XmlDocument, XmlNode } from '@rgrove/parse-xml';
import { FunctionError } from '../errors';
import { editorPrefixes, isEditorName } from './svgSafety';

interface SvgToJsxOptions {
  componentName: string;
  typescript: boolean;
}

const preservingElements = new Set(['foreignObject', 'text', 'textPath', 'tspan']);
const maxJsxLength = 2_000_000;
const jsStringEscapes = new Map([
  ['\n', '\\n'],
  ['\r', '\\r'],
  ["'", "\\'"],
  ['\\', '\\\\'],
]);

export function svgToJsx(document: XmlDocument, options: SvgToJsxOptions): string {
  const root = document.root;

  if (!root) throw new FunctionError('INVALID_SVG', 'The root element must be <svg>.');

  const declarations = declarationsOf(root);
  const bound = new Map(
    declarations.flatMap(([prefix, uri]): Array<[string, string]> => {
      const canonical = canonicalPrefixes.get(uri.trim());

      return canonical && prefix !== canonical ? [[prefix, canonical]] : [];
    }),
  );

  pruneEditorMarkup(root, editorPrefixes(declarations), bound);

  const markup = renderBlock(root, 2, false, ' {...props}');
  const header = options.typescript ? "import type { SVGProps } from 'react';\n\n" : '';
  const props = options.typescript ? 'props: SVGProps<SVGSVGElement>' : 'props';

  const output = `${header}export function ${options.componentName}(${props}) {\n  return (\n${markup}\n  );\n}`;

  if (output.length > maxJsxLength) {
    throw new FunctionError(
      'OUTPUT_TOO_LARGE',
      'The JSX output is over 2,000,000 characters; simplify the SVG first.',
    );
  }

  return output;
}

const canonicalPrefixes = new Map([
  ['http://www.w3.org/1999/xlink', 'xlink'],
  ['http://www.w3.org/XML/1998/namespace', 'xml'],
]);

function declarationsOf(element: XmlElement): Array<[string, string]> {
  const own = Object.entries(element.attributes)
    .filter(([name]) => name.startsWith('xmlns:'))
    .map(([name, value]): [string, string] => [name.slice(6), value]);

  return element.children.reduce<Array<[string, string]>>(
    (all, child) => (child instanceof XmlElement ? [...all, ...declarationsOf(child)] : all),
    own,
  );
}

// Removes editor markup up front (so unused xmlns checks never see it) and renames attributes
// whose prefix is bound to XLink or XML to the canonical xlink:/xml: that React props follow.
function pruneEditorMarkup(
  element: XmlElement,
  prefixes: Set<string>,
  bound: Map<string, string>,
): void {
  element.attributes = Object.fromEntries(
    Object.entries(element.attributes)
      .filter(([name]) => !isEditorName(name, prefixes))
      .map(([name, value]) => {
        const [prefix, local] = name.split(':', 2);
        const canonical = prefix === undefined ? undefined : bound.get(prefix);

        return local !== undefined && canonical ? [`${canonical}:${local}`, value] : [name, value];
      }),
  );

  element.children = element.children.filter(
    (child) => !(child instanceof XmlElement && isEditorName(child.name, prefixes)),
  );

  for (const child of element.children) {
    if (child instanceof XmlElement) pruneEditorMarkup(child, prefixes, bound);
  }
}

function renderBlock(element: XmlElement, depth: number, inherited: boolean, extra = ''): string {
  const indent = '  '.repeat(depth);
  const preserve = preservesWhitespace(element, inherited);
  const children = keptChildren(element, preserve);

  if (children.some((child) => child instanceof XmlText) || element.name === 'style') {
    return `${indent}${renderInline(element, inherited, extra)}`;
  }

  const open = `${indent}<${elementName(element)}${renderAttributes(element)}${extra}`;

  if (!children.length) return `${open} />`;

  return [
    `${open}>`,
    ...children.map((child) => renderBlock(child as XmlElement, depth + 1, preserve)),
    `${indent}</${element.name}>`,
  ].join('\n');
}

function renderInline(element: XmlElement, inherited: boolean, extra = ''): string {
  const preserve = preservesWhitespace(element, inherited);
  const children = keptChildren(element, preserve);
  const open = `<${elementName(element)}${renderAttributes(element)}${extra}`;

  if (!children.length) return `${open} />`;

  const body =
    element.name === 'style' && children.every((child) => child instanceof XmlText)
      ? `{\`${templateLiteral(children.map((child) => (child as XmlText).text).join(''))}\`}`
      : children
          .map((child) =>
            child instanceof XmlText ? jsxText(child.text) : renderInline(child, preserve),
          )
          .join('');

  return `${open}>${body}</${element.name}>`;
}

// Whitespace outside text content is never painted, so xml:space="preserve" on the root (as
// Inkscape writes it) does not keep the indentation between elements.
function preservesWhitespace(element: XmlElement, inherited: boolean): boolean {
  return inherited || preservingElements.has(element.name);
}

function keptChildren(element: XmlElement, preserve: boolean): Array<XmlElement | XmlText> {
  return element.children.flatMap((child: XmlNode): Array<XmlElement | XmlText> => {
    if (child instanceof XmlComment) return [];
    if (child instanceof XmlText) return preserve || child.text.trim() ? [child] : [];
    if (child instanceof XmlElement) return [child];

    throw new FunctionError(
      'UNSUPPORTED_JSX',
      `JSX cannot express a processing instruction inside <${element.name}>; remove it first.`,
    );
  });
}

function elementName(element: XmlElement): string {
  // Lowercase first letter: an uppercase JSX tag would mean a component, a dot a member access.
  if (!/^[a-z][\w-]*$/.test(element.name)) {
    throw new FunctionError(
      'UNSUPPORTED_JSX',
      `JSX cannot express the element <${element.name}>; remove it first.`,
    );
  }

  return element.name;
}

function usesPrefix(element: XmlElement, prefix: string): boolean {
  const prefixed = (name: string) => name.startsWith(`${prefix}:`);

  return (
    prefixed(element.name) ||
    Object.keys(element.attributes).some(prefixed) ||
    element.children.some((child) => child instanceof XmlElement && usesPrefix(child, prefix))
  );
}

function renderAttributes(element: XmlElement): string {
  return Object.entries(element.attributes)
    .filter(([name]) => !name.startsWith('xmlns:') || usesPrefix(element, name.slice(6)))
    .map(([name, value]) => {
      const jsxName = attributeName(name);

      if (jsxName === 'style') return ` style={${styleObject(value)}}`;

      // JSX decodes entities and folds line breaks in quoted values, so those need an expression.
      return /["\n\r]|&#?\w+;/.test(value)
        ? ` ${jsxName}={${jsString(value)}}`
        : ` ${jsxName}="${value}"`;
    })
    .join('');
}

function attributeName(name: string): string {
  if (name === 'class') return 'className';
  if (name === 'for') return 'htmlFor';
  if (name === 'tabindex') return 'tabIndex';
  if (/^(?:aria|data)-/.test(name)) return name;

  const jsxName = name.replace(/[:-]([a-z])/gi, (_match, letter: string) => letter.toUpperCase());

  if (!/^[A-Za-z_][\w-]*$/.test(jsxName)) {
    throw new FunctionError('UNSUPPORTED_JSX', `JSX cannot express the attribute ${name}.`);
  }

  return jsxName;
}

function malformedStyle(problem: string): FunctionError {
  return new FunctionError(
    'UNSUPPORTED_JSX',
    `The style attribute has ${problem}; fix it before converting to JSX.`,
  );
}

function splitDeclarations(style: string): string[] {
  const declarations: string[] = [];
  let [current, depth, quote] = ['', 0, ''];

  for (let index = 0; index < style.length; index += 1) {
    const char = style.charAt(index);

    if (quote) {
      if (char === quote) quote = '';
      else if (char === '\\') {
        current += char + style.charAt(index + 1);
        index += 1;

        continue;
      }
    } else if (char === '/' && style.charAt(index + 1) === '*') {
      const end = style.indexOf('*/', index + 2);

      if (end < 0) throw malformedStyle('an unclosed /* comment');

      index = end + 1;

      continue;
    } else if (char === '"' || char === "'") quote = char;
    else if (char === '(') depth += 1;
    else if (char === ')') {
      if (depth === 0) throw malformedStyle('an unmatched ")"');

      depth -= 1;
    } else if (char === ';' && depth === 0) {
      declarations.push(current);
      current = '';

      continue;
    }

    current += char;
  }

  if (quote) throw malformedStyle(`an unclosed ${quote} quote`);
  if (depth > 0) throw malformedStyle('an unclosed "("');

  return [...declarations, current].filter((declaration) => declaration.trim());
}

function styleObject(style: string): string {
  const entries = splitDeclarations(style).map((declaration) => {
    const colon = declaration.indexOf(':');
    const property = declaration.slice(0, Math.max(colon, 0)).trim();

    if (!property) {
      throw new FunctionError(
        'UNSUPPORTED_JSX',
        `Cannot convert the style declaration "${declaration.trim()}" to JSX.`,
      );
    }

    const value = declaration.slice(colon + 1).trim();

    // React drops a style object value that ends in !important, so reject instead of losing it.
    if (/!\s*important$/i.test(value)) {
      throw new FunctionError(
        'UNSUPPORTED_JSX',
        `React style objects cannot express !important (${declaration.trim()}); remove it first.`,
      );
    }

    return `${styleKey(property)}: ${jsString(value)}`;
  });

  return entries.length ? `{ ${entries.join(', ')} }` : '{}';
}

function styleKey(property: string): string {
  if (property.startsWith('--')) return jsString(property);

  const key = property
    .toLowerCase()
    .replace(/^-ms-/, 'ms-')
    .replace(/-([a-z])/g, (_match, letter: string) => letter.toUpperCase());

  return /^[A-Za-z_$][\w$]*$/.test(key) ? key : jsString(property);
}

function jsxText(text: string): string {
  // JSX trims and joins text across line breaks, so multi-line text keeps its exact whitespace
  // as a string expression.
  if (/[\n\r]/.test(text)) return `{${jsString(text)}}`;

  return text.replace(/[{}<>]|&(?=#?\w+;)/g, (char) => `{'${char}'}`);
}

function jsString(value: string): string {
  return `'${value.replace(/[\n\r'\\]/g, (char) => jsStringEscapes.get(char) ?? char)}'`;
}

function templateLiteral(value: string): string {
  return value.replace(/\\|`|\$\{/g, (match) => `\\${match}`);
}

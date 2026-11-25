import { XmlElement } from '@rgrove/parse-xml';
import type { XmlDocument } from '@rgrove/parse-xml';
import { FunctionError } from '../errors';
import { parseXmlDocument } from '../format/xmlDocument';
import { localName } from '../format/xmlElements';

/**
 * Parses SVG markup and rejects anything that can run script once inlined: <script>, frames and
 * embedded objects, srcdoc, on* event handlers (also animated ones) and javascript: URLs. The
 * parser rejects lone surrogates, so the accepted source is always safe to percent-encode.
 */
export function assertSafeSvg(source: string): XmlDocument {
  const document = parseXmlDocument(source);
  const root = document.root;

  if (root?.name !== 'svg') {
    throw new FunctionError(
      'INVALID_SVG',
      `The root element must be <svg>${root ? `, not <${root.name}>` : ''}.`,
    );
  }

  assertSafeElement(root);

  return document;
}

const editorNamespacePrefixes = ['a', 'graph', 'i', 'inkscape', 'serif', 'sketch', 'sodipodi', 'x'];
const standardNamespaces = new Set([
  'http://www.w3.org/1998/Math/MathML',
  'http://www.w3.org/1999/xhtml',
  'http://www.w3.org/1999/xlink',
  'http://www.w3.org/2000/svg',
  'http://www.w3.org/XML/1998/namespace',
]);

export function editorPrefixes(declarations: Iterable<[string, string]>): Set<string> {
  const prefixes = new Set(editorNamespacePrefixes);

  for (const [prefix, uri] of declarations) {
    if (standardNamespaces.has(uri.trim())) prefixes.delete(prefix.toLowerCase());
  }

  return prefixes;
}

export function isEditorName(name: string, prefixes: Set<string>): boolean {
  const [prefix, local] = name.split(':', 2);
  const declared = prefix === 'xmlns' ? local : prefix;

  return local !== undefined && prefixes.has(declared?.toLowerCase() ?? '');
}

const embeddingElements = new Set(['embed', 'frame', 'iframe', 'object', 'script']);

function assertSafeElement(element: XmlElement): void {
  const elementName = localName(element.name).toLowerCase();

  if (embeddingElements.has(elementName)) {
    throw new FunctionError('UNSAFE_SVG', `SVG must not contain a <${elementName}> element.`);
  }

  for (const [name, value] of Object.entries(element.attributes)) assertSafeAttribute(name, value);

  for (const child of element.children) {
    if (child instanceof XmlElement) assertSafeElement(child);
  }
}

function assertSafeAttribute(name: string, value: string): void {
  const attribute = localName(name).toLowerCase();

  // attributeName="onclick" on <set>/<animate> would animate an event handler into place.
  if (attribute.startsWith('on') || (attribute === 'attributename' && /^\s*on/i.test(value))) {
    throw new FunctionError(
      'UNSAFE_SVG',
      `SVG must not contain the event handler ${attribute === 'attributename' ? value.trim() : name}.`,
    );
  }

  if (attribute === 'srcdoc') {
    throw new FunctionError('UNSAFE_SVG', `SVG must not contain the attribute ${name}.`);
  }

  // Browsers ignore control characters and spaces inside a URL scheme, and SMIL values lists
  // (values="#a;javascript:…") hold several URLs, so look anywhere in the value.
  // aria-* and data-* hold free text (labels, notes), never a URL, so only the scan skips them.
  if (
    (name.includes(':') || !/^(?:aria|data)-/.test(attribute)) &&
    value
      .replace(/[\x00-\x20]/g, '')
      .toLowerCase()
      .includes('javascript:')
  ) {
    throw new FunctionError(
      'UNSAFE_SVG',
      `SVG must not contain a javascript: URL (attribute ${name}).`,
    );
  }
}

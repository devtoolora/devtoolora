import { parseXml, XmlDeclaration, XmlDocumentType, XmlElement } from '@rgrove/parse-xml';
import type { XmlDocument, XmlNode } from '@rgrove/parse-xml';
import { FunctionError } from '../errors';

export const xmlMaxLength: number = 5_000_000;

export function parseXmlDocument(
  source: string,
  options: { maxLength?: number; maxNodes?: number } = {},
): XmlDocument {
  if (!source.trim()) throw new FunctionError('EMPTY_XML', 'XML input is empty.');

  const maxLength = options.maxLength ?? xmlMaxLength;

  if (source.length > maxLength)
    throw new FunctionError(
      'XML_LIMIT',
      `XML input is limited to ${maxLength.toLocaleString('en-US')} characters.`,
    );

  try {
    const document = parseXml(source, {
      includeOffsets: true,
      preserveCdata: true,
      preserveComments: true,
      preserveDocumentType: true,
      preserveXmlDeclaration: true,
    });

    assertSupportedXml(document, options.maxNodes ?? 100_000);

    return document;
  } catch (error) {
    if (error instanceof FunctionError) throw error;
    if (error instanceof RangeError)
      throw new FunctionError(
        'INVALID_XML',
        'Invalid XML: XML nesting exceeds the supported limit.',
      );

    const message = error instanceof Error ? error.message : String(error);

    throw new FunctionError('INVALID_XML', `Invalid XML: ${message}`);
  }
}

function assertSupportedXml(document: XmlDocument, maxNodes: number): void {
  const pending: Array<{ depth: number; node: XmlNode }> = document.children.map(
    (node: XmlNode) => ({ depth: 1, node }),
  );
  let count = 0;

  while (pending.length) {
    const current = pending.pop();

    if (!current) break;

    count += 1;

    if (current.depth > 100 || count > maxNodes) {
      throw new FunctionError(
        'XML_LIMIT',
        `XML supports up to 100 nested element levels and ${maxNodes.toLocaleString('en-US')} nodes.`,
      );
    }

    assertSupportedNode(current.node);

    if (current.node instanceof XmlElement) {
      for (const node of current.node.children) {
        pending.push({ depth: current.depth + (node instanceof XmlElement ? 1 : 0), node });
      }
    }
  }
}

function assertSupportedNode(node: XmlNode): void {
  if (node instanceof XmlDocumentType) {
    throw new FunctionError(
      'UNSUPPORTED_XML_DTD',
      'DOCTYPE and DTD declarations are not supported; external entities are never loaded.',
    );
  }

  if (node instanceof XmlDeclaration && node.version !== '1.0') {
    throw new FunctionError(
      'UNSUPPORTED_XML_VERSION',
      'Use an XML 1.0 document; XML 1.1 scalar rules are not supported.',
    );
  }

  if (node instanceof XmlDeclaration && node.encoding && !/^utf-?8$/i.test(node.encoding)) {
    throw new FunctionError(
      'UNSUPPORTED_XML_ENCODING',
      'This text tool saves UTF-8; decode the source and update its encoding declaration to UTF-8 first.',
    );
  }
}

export function xmlSource(source: string, node: XmlNode): string {
  return source.slice(node.start, Math.min(node.end, source.length));
}

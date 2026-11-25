import { XmlCdata, XmlElement, XmlText } from '@rgrove/parse-xml';
import type { XmlNode } from '@rgrove/parse-xml';
import { FunctionError } from '../errors';
import { parseXmlDocument, xmlSource } from './xmlDocument';

export { jsonDocumentToXml, xmlToJson } from './xmlJson';
export type { XmlJsonOptions } from './xmlJson';

export interface XmlFormatOptions {
  indentation?: 2 | 4 | 'tab';
}

export function formatXml(input: string, options: XmlFormatOptions = {}): string {
  const indentation = options.indentation ?? 2;

  if (indentation !== 2 && indentation !== 4 && indentation !== 'tab') {
    throw new FunctionError('INVALID_XML_OPTIONS', 'Choose 2 spaces, 4 spaces or tabs.');
  }

  const document = parseXmlDocument(input);
  const pad = indentation === 'tab' ? '\t' : ' '.repeat(indentation);

  return document.children.map((node: XmlNode) => formatNode(node, input, pad, 0)).join('\n');
}

function formatNode(node: XmlNode, source: string, indentation: string, depth: number): string {
  const pad = indentation.repeat(depth);
  const raw = xmlSource(source, node);

  if (!(node instanceof XmlElement) || node.children.length === 0) return `${pad}${raw}`;

  const hasCharacterData = node.children.some(
    (child: XmlNode) =>
      child instanceof XmlCdata ||
      (child instanceof XmlText && !/^[\x20\t\r\n]*$/.test(xmlSource(source, child))),
  );
  const hasOnlyText = node.children.every((child: XmlNode) => child instanceof XmlText);

  const [firstChild] = node.children;

  if (node.preserveWhitespace || hasCharacterData || hasOnlyText || !firstChild)
    return `${pad}${raw}`;

  const startTag = source.slice(node.start, firstChild.start);
  const end = Math.min(node.end, source.length);
  const endTag = source.slice(source.lastIndexOf('</', end - 1), end);
  const children = node.children
    .filter((child: XmlNode) => !(child instanceof XmlText))
    .map((child: XmlNode) => formatNode(child, source, indentation, depth + 1));

  return [`${pad}${startTag}`, ...children, `${pad}${endTag}`].join('\n');
}

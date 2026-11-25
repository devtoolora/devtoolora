import { XmlCdata, XmlElement, XmlText } from '@rgrove/parse-xml';

const maxTextDepth = 100;

export function localName(name: string): string {
  return name.slice(name.lastIndexOf(':') + 1);
}

export function childElements(element: XmlElement): XmlElement[] {
  return element.children.filter((child): child is XmlElement => child instanceof XmlElement);
}

export function firstChild(element: XmlElement, name: string): XmlElement | undefined {
  return childElements(element).find((child) => localName(child.name) === name);
}

export function textContent(element: XmlElement, depth: number = 0): string {
  if (depth > maxTextDepth) return '';

  return element.children
    .map((node) => {
      if (node instanceof XmlElement) return textContent(node, depth + 1);

      return node instanceof XmlText || node instanceof XmlCdata ? node.text : '';
    })
    .join('');
}

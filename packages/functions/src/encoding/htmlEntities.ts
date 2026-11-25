import { decodeHTMLStrict } from 'entities';

export function encodeHtmlEntities(text: string): string {
  return text.replace(
    /[&<>"']/g,
    (character) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character] ??
      character,
  );
}

export function decodeHtmlEntities(text: string): string {
  return decodeHTMLStrict(text);
}

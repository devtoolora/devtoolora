import { FunctionError } from '../errors';

export type UrlEncodingContext = 'component' | 'url' | 'form';

export function encodeUrlText(text: string, context: UrlEncodingContext = 'component'): string {
  try {
    if (context === 'url') return encodeURI(text);

    const encoded = encodeURIComponent(text);

    return context === 'form'
      ? encoded
          .replace(/%20/g, '+')
          .replace(
            /[!'()~]/g,
            (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
          )
      : encoded;
  } catch {
    throw new FunctionError(
      'INVALID_UNICODE',
      'Input contains an incomplete Unicode surrogate. Enter valid Unicode text.',
    );
  }
}

export function decodeUrlText(text: string, context: UrlEncodingContext = 'component'): string {
  try {
    if (context === 'url') return decodeURI(text);

    return decodeURIComponent(context === 'form' ? text.replace(/\+/g, ' ') : text);
  } catch {
    throw new FunctionError(
      'INVALID_URL_ENCODING',
      'Input contains malformed percent escapes or invalid UTF-8 bytes. Check each %XX sequence.',
    );
  }
}

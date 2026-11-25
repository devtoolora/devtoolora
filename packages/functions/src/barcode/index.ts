import { FunctionError } from '../errors';
import { code128Codewords, code128Modules } from './code128';
import { code39Modules } from './code39';
import { eanDigits, ean13Modules } from './ean';

export { barcodeSvg } from './svg';

export type BarcodeFormat = 'code128' | 'code39' | 'ean13' | 'upca';

export interface EncodedBarcode {
  checkDigit?: string;
  codewords?: number[];
  humanText: string;
  modules: string;
  note?: string;
}

export function encodeBarcode(
  format: BarcodeFormat,
  text: string,
  options: { code39Check?: boolean } = {},
): EncodedBarcode {
  if (format === 'code128') {
    const codewords = code128Codewords(text);

    return { codewords, humanText: text, modules: code128Modules(codewords) };
  }

  if (format === 'code39') {
    const out = code39Modules(text, options.code39Check === true);

    return {
      checkDigit: out.check,
      humanText: out.data,
      modules: out.modules,
      note: out.uppercased ? 'Lowercase input was uppercased.' : undefined,
    };
  }

  if (format === 'ean13') {
    const digits = eanDigits('EAN-13', text, 12);

    return { checkDigit: digits.slice(12), humanText: digits, modules: ean13Modules(digits) };
  }

  if (format === 'upca') {
    const digits = eanDigits('UPC-A', text, 11);

    return {
      checkDigit: digits.slice(11),
      humanText: digits,
      modules: ean13Modules(`0${digits}`),
    };
  }

  throw new FunctionError('BARCODE_FORMAT', 'Format must be one of: code128, code39, ean13, upca.');
}

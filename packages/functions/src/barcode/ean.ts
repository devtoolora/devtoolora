import { FunctionError } from '../errors';
import { eanG, eanL, eanParity, eanR } from './tables';

const checkOf = (digits: string) => {
  const sum = [...digits].reduce(
    (total, digit, i) => total + Number(digit) * (i % 2 === 0 ? 1 : 3),
    0,
  );

  return String((10 - (sum % 10)) % 10);
};

export function eanDigits(label: string, text: string, bodyLength: 11 | 12): string {
  const digits = text.replace(/[\s-]/g, '');

  if (!/^\d+$/.test(digits) || ![bodyLength, bodyLength + 1].includes(digits.length)) {
    throw new FunctionError(
      'BARCODE_DIGITS',
      `${label} needs ${bodyLength} or ${bodyLength + 1} digits (spaces and hyphens are ignored).`,
    );
  }

  const pad = bodyLength === 11 ? '0' : '';
  const check = checkOf(pad + digits.slice(0, bodyLength));

  if (digits.length > bodyLength && digits[bodyLength] !== check) {
    throw new FunctionError('BARCODE_CHECK', `Check digit should be ${check}.`);
  }

  return digits.slice(0, bodyLength) + check;
}

export function ean13Modules(digits: string): string {
  const parity = eanParity[Number(digits[0])] ?? '';
  let modules = '101';

  for (let i = 1; i < 7; i += 1) {
    modules += (parity[i - 1] === 'G' ? eanG : eanL)[Number(digits[i])];
  }

  modules += '01010';

  for (let i = 7; i < 13; i += 1) modules += eanR[Number(digits[i])];

  return `${modules}101`;
}

import { FunctionError } from '../errors';
import { code39Characters, code39Patterns } from './tables';

export function code39Modules(text: string, withCheck: boolean) {
  if (text.length < 1 || text.length > 60) {
    throw new FunctionError('BARCODE_LENGTH', 'Code 39 input must be 1-60 characters.');
  }

  // ASCII only: toUpperCase() would turn ß into SS or ſ into S, encoding different data.
  const upper = text.replace(/[a-z]/g, (char) => char.toUpperCase());

  if (upper.includes('*')) {
    throw new FunctionError('BARCODE_CHARSET', 'Code 39 reserves * as the start/stop character.');
  }

  const bad = [...upper].find((char) => !code39Characters.includes(char));

  if (bad) {
    throw new FunctionError(
      'BARCODE_CHARSET',
      `Code 39 accepts A-Z, 0-9, - . space $ / + % only; ${JSON.stringify(bad)} is not allowed.`,
    );
  }

  const check = withCheck
    ? code39Characters[
        [...upper].reduce((sum, char) => sum + code39Characters.indexOf(char), 0) % 43
      ]
    : undefined;
  const data = upper + (check ?? '');
  const modules = ['*', ...data, '*'].map((char) => code39Patterns[char]).join('0');

  return { check, data: upper, modules, uppercased: upper !== text };
}

import { FunctionError } from '../errors';

export type TextCase =
  | 'camel'
  | 'pascal'
  | 'snake'
  | 'kebab'
  | 'constant'
  | 'title'
  | 'lower'
  | 'upper'
  | 'sentence'
  | 'alternating';
export interface CaseOptions {
  locale?: 'default' | 'tr' | 'az' | 'lt';
  removeAccents?: boolean;
}
export interface SlugOptions {
  alphabet?: 'ascii' | 'unicode';
  lowercase?: boolean;
  preserveNumbers?: boolean;
  removeAccents?: boolean;
  separator?: string;
  trimDuplicates?: boolean;
}

const cases: readonly TextCase[] = [
  'camel',
  'pascal',
  'snake',
  'kebab',
  'constant',
  'title',
  'lower',
  'upper',
  'sentence',
  'alternating',
];

export function isTextCase(value: unknown): value is TextCase {
  return typeof value === 'string' && cases.some((entry) => entry === value);
}

type CaseHelpers = {
  capitalize: (word: string) => string;
  lower: (value: string) => string;
  upper: (value: string) => string;
};

function createCaseHelpers(locale: string): CaseHelpers {
  const lower = (value: string): string =>
    locale === 'default' ? value.toLowerCase() : value.toLocaleLowerCase(locale);
  const upper = (value: string): string =>
    locale === 'default' ? value.toUpperCase() : value.toLocaleUpperCase(locale);

  const capitalize = (word: string): string => {
    const first = [...word][0] ?? '';
    const upperFirst = upper(first);
    // One letter can uppercase to several (fi ligature to FI, sharp s to SS); only the first stays.
    const head = [...upperFirst][0] ?? '';
    // The leading letter gives final sigma the context lowercasing needs.
    const rest = lower(`a${word.slice(first.length)}`).slice(1);

    return head + lower(upperFirst.slice(head.length)) + rest;
  };

  return { capitalize, lower, upper };
}

function joinCaseWords(target: TextCase, words: string[], helpers: CaseHelpers): string {
  const { capitalize, upper } = helpers;

  switch (target) {
    case 'pascal':
      return words.map(capitalize).join('');
    case 'snake':
      return words.join('_');
    case 'kebab':
      return words.join('-');
    case 'constant':
      return words.map(upper).join('_');
    default:
      return words.map((word, index) => (index === 0 ? word : capitalize(word))).join('');
  }
}

export function convertCase(
  text: string,
  target: TextCase = 'camel',
  options: CaseOptions = {},
): string {
  validateInput(text);
  if (!isTextCase(target))
    throw new FunctionError('INVALID_TEXT_CASE', 'Choose a supported target case.');

  const locale = options.locale ?? 'default';

  if (!['default', 'tr', 'az', 'lt'].includes(locale))
    throw new FunctionError(
      'INVALID_CASE_LOCALE',
      'Choose default, Turkish, Azerbaijani or Lithuanian case rules.',
    );

  const helpers = createCaseHelpers(locale);
  const { capitalize, lower, upper } = helpers;

  if (target === 'lower') return lower(text);
  if (target === 'upper') return upper(text);
  if (target === 'title')
    return text.replace(
      /[\p{L}\p{N}][\p{L}\p{M}\p{N}]*(?:['’][\p{L}\p{N}][\p{L}\p{M}\p{N}]*)*/gu,
      capitalize,
    );
  if (target === 'sentence')
    return lower(text).replace(
      /(^|[.!?]\s+|\r\n|\r|\n)([^\p{L}]*)(?<!\p{N})(\p{L})/gu,
      (_match: string, boundary: string, prefix: string, letter: string) =>
        boundary + prefix + upper(letter),
    );

  if (target === 'alternating') {
    let index = 0;

    return [...text]
      .map((character) => {
        if (lower(character) === upper(character)) return character;

        return index++ % 2 === 0 ? lower(character) : upper(character);
      })
      .join('');
  }

  const prepared =
    options.removeAccents === false ? text.normalize('NFC') : stripLatinAccents(text);
  const split = prepared
    .replace(/(\p{Lu})(\p{Lu}\p{Ll})/gu, '$1 $2')
    .replace(/([\p{Ll}\p{N}])(\p{Lu})/gu, '$1 $2');
  const words = (split.match(/[\p{L}\p{N}][\p{L}\p{M}\p{N}]*/gu) ?? []).map(lower);

  return joinCaseWords(target, words, helpers);
}

export function slugify(text: string, options: SlugOptions = {}): string {
  validateInput(text);
  const alphabet = options.alphabet ?? (options.removeAccents === false ? 'unicode' : 'ascii');

  if (alphabet !== 'ascii' && alphabet !== 'unicode')
    throw new FunctionError('INVALID_SLUG_ALPHABET', 'Choose ASCII or Unicode characters.');

  const separator = options.separator ?? '-';

  if (!['-', '_', '.'].includes(separator))
    throw new FunctionError(
      'INVALID_SLUG_SEPARATOR',
      'Slug separator must be -, _ or .; URL path delimiters and whitespace are not allowed.',
    );

  // Soft hyphens, zero-width spaces and word joiners sit inside a word; they do not separate words.
  let prepared = text.normalize('NFC').replace(/[\u00AD\u200B\u2060\uFEFF]/g, '');

  if (alphabet === 'ascii' || options.removeAccents !== false)
    prepared = stripLatinAccents(prepared);

  if (alphabet === 'ascii') {
    const latin: Record<string, string> = {
      Æ: 'AE',
      Ð: 'D',
      Ø: 'O',
      Þ: 'TH',
      ß: 'ss',
      æ: 'ae',
      ð: 'd',
      ø: 'o',
      þ: 'th',
      Đ: 'D',
      đ: 'd',
      Ħ: 'H',
      ħ: 'h',
      ı: 'i',
      Ł: 'L',
      ł: 'l',
      Œ: 'OE',
      œ: 'oe',
      Ŧ: 'T',
      ŧ: 't',
      ẞ: 'SS',
    };

    prepared = prepared.replace(/[ÆÐØÞßæðøþĐđĦħıŁłŒœŦŧẞ]/g, (letter) => latin[letter] ?? letter);
  }

  if (options.lowercase !== false) prepared = prepared.toLowerCase();
  if (options.preserveNumbers === false) prepared = prepared.replace(/\p{N}+/gu, ' ');

  const pattern = alphabet === 'ascii' ? /[A-Za-z0-9]+/g : /[\p{L}\p{N}][\p{L}\p{M}\p{N}]*/gu;

  return (prepared.match(pattern) ?? []).join(separator);
}

function stripLatinAccents(text: string): string {
  return text
    .normalize('NFD')
    .replace(/(\p{Script=Latin})\p{M}+/gu, '$1')
    .normalize('NFC');
}

function validateInput(text: string): void {
  if (text.length > 100_000)
    throw new FunctionError(
      'TEXT_NAMING_LIMIT',
      'Naming transformations support up to 100,000 input characters.',
    );
  if (/[\uD800-\uDFFF]/u.test(text))
    throw new FunctionError(
      'INVALID_TEXT_UNICODE',
      'Text contains an unpaired Unicode surrogate. Provide valid Unicode text.',
    );
}

import { FunctionError } from '../errors/FunctionError';

export type IdnRow = { input: string; output: string; warning?: string };

const base = 36;
const tMin = 1;
const tMax = 26;
const skew = 38;
const damp = 700;
const initialBias = 72;
const initialN = 128;
const maxLines = 1000;
const maxLabel = 63;
const maxDomain = 253;
const maxInt = 0x7fffffff;
// The URL standard's forbidden domain code points, so a pasted URL fails instead of being encoded.
const forbiddenDomainCharacter = /[\u0000-\u0020\u007f#%/:<>?@[\\\]^|]/;
const scripts = ['Latin', 'Cyrillic', 'Greek'] as const;
const scriptPatterns = {
  Cyrillic: /\p{Script=Cyrillic}/u,
  Greek: /\p{Script=Greek}/u,
  Latin: /\p{Script=Latin}/u,
};

function digitToChar(digit: number): string {
  return String.fromCharCode(digit < 26 ? digit + 97 : digit + 22);
}

function charToDigit(code: number): number {
  if (code >= 48 && code <= 57) return code - 22;
  if (code >= 65 && code <= 90) return code - 65;
  if (code >= 97 && code <= 122) return code - 97;

  return base;
}

function adapt(delta: number, count: number, first: boolean): number {
  let value = first ? Math.floor(delta / damp) : delta >> 1;
  let k = 0;

  value += Math.floor(value / count);

  while (value > ((base - tMin) * tMax) >> 1) {
    value = Math.floor(value / (base - tMin));
    k += base;
  }

  return k + Math.floor(((base - tMin + 1) * value) / (value + skew));
}

function threshold(k: number, bias: number): number {
  if (k <= bias) return tMin;

  return k >= bias + tMax ? tMax : k - bias;
}

function encodeVariable(delta: number, bias: number): string {
  let output = '';
  let q = delta;

  for (let k = base; ; k += base) {
    const t = threshold(k, bias);

    if (q < t) break;

    output += digitToChar(t + ((q - t) % (base - t)));
    q = Math.floor((q - t) / (base - t));
  }

  return output + digitToChar(q);
}

export function punycodeEncodeLabel(label: string): string {
  const codePoints = Array.from(label, (char) => char.codePointAt(0) ?? 0);
  const basic = codePoints.filter((code) => code < initialN);
  let output = basic.map((code) => String.fromCharCode(code)).join('');
  let handled = basic.length;
  let n = initialN;
  let delta = 0;
  let bias = initialBias;

  if (basic.length > 0) output += '-';

  while (handled < codePoints.length) {
    const next = codePoints.reduce((min, code) => (code >= n && code < min ? code : min), maxInt);

    delta += (next - n) * (handled + 1);
    n = next;

    for (const code of codePoints) {
      if (code < n) delta += 1;

      if (code === n) {
        output += encodeVariable(delta, bias);
        bias = adapt(delta, handled + 1, handled === basic.length);
        delta = 0;
        handled += 1;
      }
    }

    delta += 1;
    n += 1;
  }

  return output;
}

export function punycodeDecodeLabel(label: string): string {
  const split = label.lastIndexOf('-');
  const output: number[] = Array.from(split > 0 ? label.slice(0, split) : '', (char) =>
    char.charCodeAt(0),
  );
  let index = 0;
  let n = initialN;
  let i = 0;
  let bias = initialBias;

  if (output.some((code) => code >= initialN))
    throw new FunctionError('INVALID_PUNYCODE', 'Invalid Punycode.');

  for (index = split > 0 ? split + 1 : 0; index < label.length;) {
    const oldI = i;
    let weight = 1;

    for (let k = base; ; k += base) {
      const digit = charToDigit(label.charCodeAt(index));

      index += 1;

      if (Number.isNaN(digit) || digit >= base) {
        throw new FunctionError('INVALID_PUNYCODE', 'Invalid Punycode.');
      }

      i += digit * weight;

      if (i > maxInt) throw new FunctionError('INVALID_PUNYCODE', 'Invalid Punycode.');

      const t = threshold(k, bias);

      if (digit < t) break;

      weight *= base - t;

      if (index >= label.length) throw new FunctionError('INVALID_PUNYCODE', 'Invalid Punycode.');
    }

    bias = adapt(i - oldI, output.length + 1, oldI === 0);
    n += Math.floor(i / (output.length + 1));
    i %= output.length + 1;

    if (n > 0x10ffff || (n >= 0xd800 && n <= 0xdfff))
      throw new FunctionError('INVALID_PUNYCODE', 'Invalid Punycode.');

    output.splice(i, 0, n);
    i += 1;
  }

  return String.fromCodePoint(...output);
}

// The URL parser applies the full IDNA mapping (ignored characters, sigma, joiner rules) and the
// .invalid suffix stops an all-numeric domain from being read as an IPv4 address.
function idnaAsciiLabel(label: string): string {
  const suffix = '.invalid';

  return new URL(`https://${label}${suffix}`).hostname.slice(0, -suffix.length);
}

function decodeAceLabel(label: string): string {
  idnaAsciiLabel(label);

  const decoded = punycodeDecodeLabel(label.slice(4));

  // URL parsers disagree across engine versions on control characters such as xn--a (U+0080).
  if (
    /^[\x00-\x7F]*$/.test(decoded) ||
    /[\p{Cc}\p{Co}]/u.test(decoded) ||
    punycodeEncodeLabel(decoded) !== label.slice(4)
  ) {
    throw new FunctionError('INVALID_PUNYCODE', 'Invalid Punycode.');
  }

  return decoded;
}

function mixedScriptWarning(labels: string[]): string | undefined {
  for (const label of labels) {
    const found = scripts.filter((script) => scriptPatterns[script].test(label));

    if (found.length > 1) {
      return `Label "${label}" mixes ${found.slice(0, -1).join(', ')} and ${found[found.length - 1]} letters, which can be a homograph.`;
    }
  }

  return undefined;
}

function toAsciiLabel(label: string): string {
  try {
    return idnaAsciiLabel(label);
  } catch {
    throw new FunctionError('INVALID_DOMAIN', `label "${label}" is not a valid domain label.`);
  }
}

function convertLine(line: string, direction: 'toAscii' | 'toUnicode'): IdnRow {
  const trimmed = line.trim();
  const at = trimmed.lastIndexOf('@');
  const prefix = at >= 0 ? trimmed.slice(0, at + 1) : '';
  const domain = trimmed.slice(at + 1);

  if (forbiddenDomainCharacter.test(domain.normalize('NFKC'))) {
    throw new FunctionError(
      'INVALID_DOMAIN',
      `"${domain}" is not a domain name. Enter only the host, without a scheme, port, path or spaces.`,
    );
  }

  const labels = domain.split(/[.\u3002\uFF0E\uFF61]/);
  const unicodeLabels: string[] = [];
  const converted = labels.map((raw) => {
    if (raw.length > maxLabel * 2 || Array.from(raw).length > maxLabel) {
      throw new FunctionError('LABEL_TOO_LONG', 'label exceeds 63 characters.');
    }

    const label = raw.normalize('NFKC').toLowerCase();

    if (direction === 'toUnicode') {
      if (!label.startsWith('xn--')) {
        unicodeLabels.push(label);

        return label;
      }

      if (label.length > maxLabel) {
        throw new FunctionError('LABEL_TOO_LONG', 'label exceeds 63 characters.');
      }

      try {
        const decoded = decodeAceLabel(label);

        unicodeLabels.push(decoded);

        return decoded;
      } catch {
        throw new FunctionError('INVALID_PUNYCODE', `invalid Punycode label "${label}".`);
      }
    }

    unicodeLabels.push(label);
    const ascii = toAsciiLabel(raw);

    if (ascii.length > maxLabel)
      throw new FunctionError('LABEL_TOO_LONG', 'label exceeds 63 characters.');

    return ascii;
  });

  if (direction === 'toAscii' && converted.join('.').length > maxDomain) {
    throw new FunctionError('DOMAIN_TOO_LONG', 'domain exceeds 253 characters.');
  }

  const warning = mixedScriptWarning(unicodeLabels);
  const row: IdnRow = { input: trimmed, output: prefix + converted.join('.') };

  if (warning) row.warning = warning;

  return row;
}

export function convertDomains(text: string, direction: 'toAscii' | 'toUnicode'): IdnRow[] {
  const lines = text.split(/\r\n|\r|\n/).filter((line) => line.trim() !== '');

  if (lines.length > maxLines)
    throw new FunctionError('INPUT_TOO_LARGE', 'Input is limited to 1,000 lines.');

  return lines.map((line, index) => {
    try {
      return convertLine(line, direction);
    } catch (error) {
      if (error instanceof FunctionError) {
        throw new FunctionError(error.code, `Line ${index + 1}: ${error.message}`);
      }

      throw error;
    }
  });
}

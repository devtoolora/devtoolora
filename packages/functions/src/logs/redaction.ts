import { checkLogInput, logError } from './shared';

const MASK = '<redacted>';
const PEM_MASK = '<redacted-private-key>';
// Stands in for each line break a mask swallowed, so a later pass can still name the input's line.
const SWALLOWED_LINE = '\uFFFF';
const LINE_BREAK = /\r\n|\r|\n|\uFFFF/g;

// A bare pwd holding a path is the working directory variable of an env dump, not a password.
const PATH_VALUE = /(?<!\\)\\*["'`]?(?:[/~]|[A-Za-z]:[\\/])/y;
const BARE_PWD_KEY = /^pwd\b/i;

const lineBreaks = (text: string): number => text.match(LINE_BREAK)?.length ?? 0;
const lineAt = (text: string, offset: number): number => lineBreaks(text.slice(0, offset)) + 1;

export function redactLogText(
  text: string,
  additionalNames = '',
): { redactions: number; text: string; warning?: string } {
  checkLogInput(text);
  if (additionalNames.length > 4096)
    throw logError('Additional sensitive names exceed 4,096 characters.');

  const customNames = additionalNames
    .split(',')
    .map((name) => name.trim())
    .filter(Boolean)
    .map(escapeRegExp);
  const standard =
    'api[_-]?key|access[_-]?key|access[_-]?token|authorization|auth|token|secret[_-]?key|secret|password|passwd|pwd|passphrase|[A-Za-z0-9]+_pass|private[_-]?key|cookie|session(?:id)?';
  const sensitiveName = `(?:${standard}${customNames.length ? `|${customNames.join('|')}` : ''})`;
  let redactions = 0;
  let output = text;
  let openLine = Number.POSITIVE_INFINITY;

  for (const { pattern, replacement, runsToEnd } of redactionRules(sensitiveName)) {
    let isOpenEnded = false;

    output = output.replace(pattern, (match, ...captures: string[]) => {
      const masked =
        typeof replacement === 'function' ? replacement(match, ...captures) : replacement;

      if (masked !== match) redactions += 1;
      if (runsToEnd?.(match)) isOpenEnded = true;

      return masked;
    });

    if (isOpenEnded) openLine = Math.min(openLine, lineAt(output, output.lastIndexOf('<redacted')));
  }

  for (const keyPattern of [
    fieldKeyPattern(sensitiveName, 'gi'),
    fieldKeyPattern(CAMEL_NAME, 'g'),
    flagKeyPattern(sensitiveName),
  ]) {
    const fields = redactFields(output, keyPattern);

    output = fields.text;
    redactions += fields.redactions;
    openLine = Math.min(openLine, fields.openLine);
  }

  return {
    redactions,
    text: output.replaceAll(SWALLOWED_LINE, ''),
    ...(Number.isFinite(openLine) && {
      warning: `A quote, bracket or private key block on line ${openLine} never closes, so everything after it is masked.`,
    }),
  };
}

type RedactionRule = {
  pattern: RegExp;
  replacement: string | ((match: string, ...captures: string[]) => string);
  runsToEnd?: (match: string) => boolean;
};

const keepPrefix = (_match: string, prefix: string) => `${prefix}${MASK}`;

// camelCase and PascalCase keys such as clientSecret or RefreshToken end in a capitalized name; the
// passes that use it are case-sensitive.
const CAMEL_NAME =
  '[A-Za-z][A-Za-z0-9]*?(?:Token|Secret|Password|Passwd|Pwd|Pass|Passphrase|ApiKey|AccessKey|SecretKey|PrivateKey)';

function redactionRules(sensitiveName: string): RedactionRule[] {
  // A query key is sensitive when a name is the whole key or its last part after _, - or ., such as
  // github_token or x-api-key.
  const keyPrefix = '(?:[A-Za-z0-9]+[_.-])*';

  return [
    {
      // Certificates and public keys are other labels, so they stay.
      pattern:
        /-----BEGIN [A-Z0-9 ]*PRIVATE KEY(?: BLOCK)?-----[\s\S]*?(?:-----END [A-Z0-9 ]*PRIVATE KEY(?: BLOCK)?-----|$)/g,
      replacement: (match) => PEM_MASK + SWALLOWED_LINE.repeat(lineBreaks(match)),
      runsToEnd: (match) => !/-----END [A-Z0-9 ]*PRIVATE KEY(?: BLOCK)?-----$/.test(match),
    },
    {
      // Empty parts occur in unsigned JWTs and in JWEs with direct key agreement.
      pattern: /\beyJ[A-Za-z0-9_-]{6,}(?:\.[A-Za-z0-9_-]*){2,}/g,
      replacement: '<redacted-jwt>',
    },
    {
      pattern: /(\b(?:authorization|proxy-authorization)\s*[:=]\s*)[^\r\n]+/gi,
      replacement: keepPrefix,
    },
    { pattern: /(\b(?:set-cookie|cookie)\s*[:=]\s*)[^\r\n]+/gi, replacement: keepPrefix },
    { pattern: /:\/\/\S+/g, replacement: maskUrlCredentials },
    {
      pattern:
        /(?:^|\s)(?:-[uU]|--user|--proxy-user)[\s=]*(?:"[^":]*:[^"]*"?|'[^':]*:[^']*'?|[^\s:"']*:\S+)/gm,
      replacement: (match) => {
        const kept = match.slice(0, match.indexOf(':') + 1);

        return `${kept}${MASK}${SWALLOWED_LINE.repeat(lineBreaks(match.slice(kept.length)))}`;
      },
      runsToEnd: (match) => /^\s*-[-\w]*[\s=]*["']/.test(match) && !/["']$/.test(match),
    },
    { pattern: /(\bBearer\s+)[^\s"'\\]+/gi, replacement: keepPrefix },
    {
      pattern: new RegExp(`([?&]${keyPrefix}${sensitiveName}=)[^&#\\s]+`, 'gi'),
      replacement: (match, prefix) =>
        /^.pwd=$/i.test(prefix) && matchAt(PATH_VALUE, match, prefix.length) !== undefined
          ? match
          : keepPrefix(match, prefix),
    },
    {
      pattern: new RegExp(`([?&]${CAMEL_NAME}=)[^&#\\s]+`, 'g'),
      replacement: keepPrefix,
    },
  ];
}

/**
 * Takes `://` and the rest of a URL up to whitespace. The password ends at the last @ of that text,
 * because a real one can hold raw @ or / characters.
 */
function maskUrlCredentials(url: string): string {
  const rest = url.slice(3);
  const authority = /^[^/?#]*/.exec(rest)?.[0] ?? '';
  const colon = rest.indexOf(':');
  const lastAt = rest.lastIndexOf('@');
  // shortcut: an all-digit password followed by a raw / reads as a port, percent-encode to mask it.
  const isPort = /^\d+(?:[/?#]|$)/.test(rest.slice(colon + 1));

  if (colon !== -1 && colon < authority.length && lastAt > colon && !isPort)
    return `://${rest.slice(0, colon + 1)}${MASK}${rest.slice(lastAt)}`;

  // A lone name before @ is often an access token, as in https://ghp_abc@github.com/org/repo.
  const authorityAt = authority.lastIndexOf('@');

  return authorityAt === -1 ? url : `://${MASK}${rest.slice(authorityAt)}`;
}

// A name must be the whole key or follow a non-alphanumeric character, so github_token, x-api-key
// and db.password match. A name followed by more characters (tokenizer, password_policy) is a
// different key. The key may close with a quote at any escape depth, as in {\"token\":\"abc\"}.
function fieldKeyPattern(name: string, flags: string): RegExp {
  return new RegExp(`(?<![A-Za-z0-9])${name}\\b(\\\\*["'\`])?\\s*(?:=>|[:=])\\s*`, flags);
}

// A long flag with a sensitive name, with the value after = or a space. A name followed by more
// text, as in --password-file, and a negated flag such as --no-password are other flags, and a next
// word that is itself a flag is no value. Short flags such as -phunter2 look like any other flag.
function flagKeyPattern(name: string): RegExp {
  return new RegExp(
    `(?<![\\w-])--(?!no-)(?:[A-Za-z0-9]+[-_])*(?:${name}|pass)(?:[ \\t]*=[ \\t]*|[ \\t]+(?![ \\t]|--|[\\r\\n]|$))`,
    'gim',
  );
}

function isWorkingDirectory(text: string, index: number, key: string, start: number): boolean {
  return (
    BARE_PWD_KEY.test(key) &&
    !/[\w.-]/.test(text.charAt(index - 1)) &&
    matchAt(PATH_VALUE, text, start) !== undefined
  );
}

function redactFields(
  text: string,
  keyPattern: RegExp,
): { openLine: number; redactions: number; text: string } {
  const parts: string[] = [];
  let cursor = 0;
  let redactions = 0;
  let openLine = Number.POSITIVE_INFINITY;

  for (let key = keyPattern.exec(text); key; key = keyPattern.exec(text)) {
    const start = key.index + key[0].length;

    if (isWorkingDirectory(text, key.index, key[0], start)) continue;

    const value = readFieldValue(text, start, key[1] !== undefined);

    if (!value) continue;

    if (value.isOpenEnded) openLine = Math.min(openLine, lineAt(text, start));

    parts.push(
      text.slice(cursor, start),
      value.mask,
      SWALLOWED_LINE.repeat(lineBreaks(text.slice(start, value.end))),
    );

    cursor = value.end;
    keyPattern.lastIndex = value.end;
    redactions += 1;
  }

  parts.push(text.slice(cursor));

  return { openLine, redactions, text: parts.join('') };
}

// A value starts after a separator and a nested token after a bracket or a closed string, never
// inside a run of backslashes or digits. The lookbehinds state that, so a run is scanned once
// rather than again from each of its characters.
const VALUE_DELIMITER = /(?<!\\)\\*["'`]/y;
const AFTER_CLOSE = /[^\s,;)}\]]*/y;
const JSON_LITERAL = /(?<![\d.eE+-])(?:-?\d[\d.eE+-]*|true|false|null)(?=[\s,}\]]|$)/y;
const BARE_VALUE = /\S+/y;
const NESTED_TOKEN = /(?<!\\)(\\*["'`])|[[\]{}()]/g;
const CLOSERS: Record<string, string> = { '(': ')', '[': ']', '{': '}' };

function matchAt(pattern: RegExp, text: string, index: number): string | undefined {
  pattern.lastIndex = index;

  return pattern.exec(text)?.[0];
}

/**
 * Finds where the value at `start` ends and what replaces it. Any doubt goes toward masking more:
 * an unquoted value runs to the next whitespace, whatever it holds, and an unterminated string or
 * bracket runs to the end of the text.
 */
function readFieldValue(
  text: string,
  start: number,
  isKeyQuoted: boolean,
): { end: number; isOpenEnded?: boolean; mask: string } | undefined {
  const delimiter = matchAt(VALUE_DELIMITER, text, start) ?? '';
  const content = start + delimiter.length;

  if (content >= text.length || text.startsWith(MASK, content)) return undefined;

  if (delimiter) {
    const close = quotedEnd(text, content, delimiter);
    const mask = isKeyQuoted ? `${delimiter}${MASK}${delimiter}` : MASK;

    if (close === undefined) return { end: text.length, isOpenEnded: true, mask };

    return { end: close + (matchAt(AFTER_CLOSE, text, close)?.length ?? 0), mask };
  }

  const closer = CLOSERS[text.charAt(start)];

  if (closer) {
    const close = nestedEnd(text, start, closer);

    if (close === undefined) return { end: text.length, isOpenEnded: true, mask: MASK };

    return { end: close + (matchAt(AFTER_CLOSE, text, close)?.length ?? 0), mask: MASK };
  }

  // Only a key in quotes is JSON-like, so 12,34 after a bare key stays one value.
  const literal = isKeyQuoted ? matchAt(JSON_LITERAL, text, start) : undefined;
  const value = literal ?? matchAt(BARE_VALUE, text, start) ?? '';

  return { end: start + value.length, mask: MASK };
}

function quotedEnd(text: string, from: number, delimiter: string): number | undefined {
  const quote = delimiter.charAt(delimiter.length - 1);
  const depth = delimiter.length - 1;

  for (let at = text.indexOf(quote, from); at !== -1; at = text.indexOf(quote, at + 1)) {
    let backslashes = 0;

    while (at - backslashes > from && text[at - backslashes - 1] === '\\') backslashes += 1;

    const closes = depth === 0 ? backslashes % 2 === 0 : backslashes === depth;

    if (!closes) continue;
    // A doubled quote is a literal one in SQL and in YAML.
    if (text[at + 1] === quote) {
      at += 1;

      continue;
    }

    return at + 1;
  }

  return undefined;
}

function nestedEnd(text: string, open: number, closer: string): number | undefined {
  const opener = text.charAt(open);
  let depth = 0;

  NESTED_TOKEN.lastIndex = open;

  for (let token = NESTED_TOKEN.exec(text); token; token = NESTED_TOKEN.exec(text)) {
    if (token[1]) {
      const close = quotedEnd(text, NESTED_TOKEN.lastIndex, token[1]);

      if (close === undefined) return undefined;

      NESTED_TOKEN.lastIndex = close;
    } else if (token[0] === opener) {
      depth += 1;
    } else if (token[0] === closer) {
      depth -= 1;

      if (depth === 0) return NESTED_TOKEN.lastIndex;
    }
  }

  return undefined;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

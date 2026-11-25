import { FunctionError } from '../errors';

const VARIABLE_NAME = /^[A-Za-z_][A-Za-z0-9_]*$/;

export type DotenvAssignment = {
  /** The # touches the value, so sh and python-dotenv read the comment as part of the value. */
  attachedComment?: boolean;
  exportPrefix: boolean;
  inlineComment?: string;
  key: string;
  kind: 'assignment';
  lineNumber: number;
  quote?: '"' | "'";
  value: string;
};

export type DotenvLine = DotenvAssignment | { kind: 'blank' | 'comment'; raw: string };

export type DotenvDiagnostic = { lineNumber: number; message: string };

export type DotenvDocument = {
  diagnostics: DotenvDiagnostic[];
  endsWithNewline: boolean;
  lines: DotenvLine[];
};

export function inspectDotenv(text: string): DotenvDocument {
  if (text.length > 1_048_576) throw configError('.env input exceeds 1,048,576 characters.');

  const lines = text.replace(/^\uFEFF/, '').split(/\r\n?|\n/);
  const endsWithNewline = /[\r\n]$/.test(text);

  if (endsWithNewline) lines.pop();

  const parsedLines: DotenvLine[] = [];
  const diagnostics: DotenvDiagnostic[] = [];
  const firstDeclaration = new Map<string, number>();

  for (const [index, line] of lines.entries()) {
    const lineNumber = index + 1;
    const parsed = parseLine(line, lineNumber);

    if ('message' in parsed) {
      diagnostics.push(parsed);

      continue;
    }

    parsedLines.push(parsed);

    if (parsed.kind === 'assignment') {
      const firstLine = firstDeclaration.get(parsed.key);

      if (firstLine !== undefined)
        diagnostics.push({
          lineNumber,
          message: `Duplicate variable "${parsed.key}" (first declared on line ${firstLine}).`,
        });
      else firstDeclaration.set(parsed.key, lineNumber);
    }
  }

  return { lines: parsedLines, diagnostics, endsWithNewline };
}

export function parseDotenv(text: string): DotenvDocument {
  const document = inspectDotenv(text);

  if (document.diagnostics.length)
    throw configError(
      `Invalid .env input: ${listDotenvDiagnostics(document.diagnostics).join(' ')}`,
    );

  return document;
}

export function formatDotenv(document: DotenvDocument): string {
  const output = document.lines.map((line) => {
    if (line.kind !== 'assignment') return line.raw;

    const value = line.quote ? `${line.quote}${line.value}${line.quote}` : line.value;

    return `${line.exportPrefix ? 'export ' : ''}${line.key}=${value}${inlineCommentSuffix(line.inlineComment)}`;
  });

  return `${output.join('\n')}${document.endsWithNewline ? '\n' : ''}`;
}

function inlineCommentSuffix(comment: string | undefined): string {
  if (comment === undefined) return '';

  return comment ? ` # ${comment}` : ' #';
}

export function redactDotenv(
  document: DotenvDocument,
  additionalNames = '',
  removeComments = false,
): string {
  const customNames = new Set(
    additionalNames
      .split(',')
      .map((name) => name.trim())
      .filter(Boolean),
  );

  if ([...customNames].some((name) => !VARIABLE_NAME.test(name)))
    throw configError('Additional sensitive names must be comma-separated exact variable names.');

  return formatDotenv({
    ...document,
    lines: document.lines
      .filter((line) => !removeComments || line.kind !== 'comment')
      .map((line) => {
        if (line.kind !== 'assignment') return line;

        return {
          ...line,
          ...(isSensitiveVariableName(line.key, customNames)
            ? {
                ...(line.attachedComment ? { inlineComment: undefined } : {}),
                quote: undefined,
                value: '<redacted>',
              }
            : {}),
          ...(removeComments ? { inlineComment: undefined } : {}),
        };
      }),
  });
}

const MAX_LISTED_DIAGNOSTICS = 20;

export function listDotenvDiagnostics(diagnostics: DotenvDiagnostic[]): string[] {
  const rest = diagnostics.length - MAX_LISTED_DIAGNOSTICS;
  const lines = diagnostics
    .slice(0, MAX_LISTED_DIAGNOSTICS)
    .map((diagnostic) => `Line ${diagnostic.lineNumber}: ${diagnostic.message}`);

  return rest > 0 ? [...lines, `… and ${rest} more issue${rest === 1 ? '' : 's'}.`] : lines;
}

function parseLine(line: string, lineNumber: number): DotenvLine | DotenvDiagnostic {
  if (line.trim() === '') return { kind: 'blank', raw: line };
  if (/^\s*#/.test(line)) return { kind: 'comment', raw: line };

  const match = line.match(/^\s*(?:(export)\s+)?([^=]*)(?:=(.*))?$/);

  if (!match || match[3] === undefined)
    return { lineNumber, message: 'Expected a KEY=value assignment.' };

  const key = match[2]!.trim();

  if (!VARIABLE_NAME.test(key))
    return { lineNumber, message: `Invalid variable name "${key || '(empty)'}".` };

  const parsedValue = parseValue(match[3].trimStart(), lineNumber);

  if ('message' in parsedValue) return parsedValue;

  return { kind: 'assignment', lineNumber, exportPrefix: Boolean(match[1]), key, ...parsedValue };
}

function parseValue(
  valueSource: string,
  lineNumber: number,
):
  | Pick<DotenvAssignment, 'attachedComment' | 'value' | 'quote' | 'inlineComment'>
  | DotenvDiagnostic {
  const quote = valueSource[0];

  if (quote === '"' || quote === "'") {
    let escaped = false;

    for (let index = 1; index < valueSource.length; index += 1) {
      const character = valueSource[index];

      if (quote === '"' && character === '\\' && !escaped) {
        escaped = true;

        continue;
      }

      if (character === quote && !escaped) {
        const remainder = valueSource.slice(index + 1).trimStart();

        if (remainder && !remainder.startsWith('#'))
          return { lineNumber, message: 'Unexpected content after a quoted value.' };

        return {
          value: valueSource.slice(1, index),
          quote,
          ...(remainder.startsWith('#') ? { inlineComment: remainder.slice(1).trimStart() } : {}),
          ...(valueSource[index + 1] === '#' ? { attachedComment: true } : {}),
        };
      }

      escaped = false;
    }

    return { lineNumber, message: 'Unterminated quoted value.' };
  }

  const commentIndex = valueSource.indexOf('#');
  const value = (commentIndex === -1 ? valueSource : valueSource.slice(0, commentIndex)).trimEnd();
  const inlineComment =
    commentIndex === -1 ? undefined : valueSource.slice(commentIndex + 1).trimStart();

  return {
    value,
    ...(inlineComment !== undefined ? { inlineComment } : {}),
    ...(commentIndex !== -1 && !/\s/.test(valueSource.charAt(commentIndex - 1))
      ? { attachedComment: true }
      : {}),
  };
}

function isSensitiveVariableName(name: string, customNames: Set<string>): boolean {
  return (
    customNames.has(name) ||
    /(?:^|_)(?:TOKEN|SECRET|PASSWORD|PASS|API_KEY|ACCESS_KEY|PRIVATE|KEY)(?:_|$)/i.test(name)
  );
}

function configError(message: string): FunctionError {
  return new FunctionError('INVALID_CONFIG', message);
}

import { checkLogInput, logError } from './shared';

type JsonlFieldProfile = { present: number; types: Set<string> };

export function inspectJsonLines(text: string): string {
  checkLogInput(text);
  const lines = nonBlankLines(text.replace(/^\uFEFF/, ''));

  if (!lines.length) throw logError('JSON Lines input is required.');

  const fields = new Map<string, JsonlFieldProfile>();
  const diagnostics: string[] = [];
  let validRecords = 0;

  for (const { lineNumber, text: line } of lines) {
    try {
      const value: unknown = JSON.parse(line);

      if (!isRecord(value)) {
        diagnostics.push(`Line ${lineNumber}: Expected a JSON object.`);

        continue;
      }

      validRecords += 1;

      for (const [name, fieldValue] of Object.entries(value)) {
        const profile = fields.get(name) ?? { present: 0, types: new Set<string>() };

        profile.present += 1;
        profile.types.add(jsonType(fieldValue));
        fields.set(name, profile);
      }
    } catch {
      diagnostics.push(`Line ${lineNumber}: Invalid JSON.`);
    }
  }

  const fieldSections = [...fields.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .flatMap(([name, profile]) => [
      `## ${name}`,
      `Types: ${[...profile.types].sort().join(', ')}`,
      `Present: ${profile.present}/${validRecords}`,
      '',
    ]);
  const diagnosticSection = diagnostics.length
    ? ['## Diagnostics', ...diagnostics.map((diagnostic) => `- ${diagnostic}`), '']
    : [];

  return [
    '# JSON Lines Inspector',
    '',
    `Records: ${lines.length}`,
    `Valid objects: ${validRecords}`,
    `Malformed: ${diagnostics.length}`,
    '',
    ...fieldSections,
    ...diagnosticSection,
  ]
    .join('\n')
    .trimEnd();
}

function nonBlankLines(text: string): Array<{ lineNumber: number; text: string }> {
  return text
    .split(/\r\n?|\n/)
    .map((line, index) => ({ lineNumber: index + 1, text: line }))
    .filter(({ text: line }) => line.trim());
}

function jsonType(value: unknown): string {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  if (typeof value === 'number') return Number.isInteger(value) ? 'integer' : 'number';
  if (typeof value === 'object') return 'object';

  return typeof value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

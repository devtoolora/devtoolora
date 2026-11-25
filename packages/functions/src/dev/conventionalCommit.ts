import { devError } from './shared';

export const commitTypes = [
  'feat',
  'fix',
  'docs',
  'style',
  'refactor',
  'perf',
  'test',
  'build',
  'ci',
  'chore',
  'revert',
] as const;

export type CommitType = (typeof commitTypes)[number];

export type CommitOptions = {
  body: string;
  breaking: boolean;
  breakingText: string;
  description: string;
  footers: string;
  scope: string;
  type: CommitType;
};

const maxScopeLength = 50;
const maxFooterLines = 100;
const recommendedHeaderLength = 72;
const footerPattern = /^(?:BREAKING[ -]CHANGE|[A-Za-z][A-Za-z0-9-]*)(?:: | #)\S/;

function normalizeLines(text: string): string[] {
  const lines = text.replace(/\r\n?/g, '\n').split('\n');

  while (lines.at(-1)?.trim() === '') lines.pop();

  return lines;
}

function buildFooters(footers: string): string[] {
  const lines = normalizeLines(footers).filter((line) => line.trim() !== '');

  if (lines.length > maxFooterLines)
    throw devError(`Footers are limited to ${maxFooterLines} lines.`);

  lines.forEach((line, index) => {
    if (!footerPattern.test(line))
      throw devError(`Footer line ${index + 1} must be "Token: value" or "Token #value".`);
  });

  return lines;
}

export function buildConventionalCommit(options: CommitOptions): {
  header: string;
  message: string;
  warnings: string[];
} {
  if (!(commitTypes as readonly string[]).includes(options.type))
    throw devError('Choose a commit type.');

  const description = options.description.trim();
  const scope = options.scope.trim();

  if (description === '') throw devError('Enter a description.');
  if (/[\r\n]/.test(description)) throw devError('Description must be one line.');
  if (scope.length > maxScopeLength)
    throw devError(`Scope is limited to ${maxScopeLength} characters.`);
  if (!/^[A-Za-z0-9._/,-]*$/.test(scope))
    throw devError('Scope may contain letters, digits and . _ / , - only.');

  const footers = buildFooters(options.footers);
  const breakingText = options.breakingText.replace(/\r\n?/g, '\n').trim();
  const header = `${options.type}${scope === '' ? '' : `(${scope})`}${options.breaking ? '!' : ''}: ${description}`;
  const body = normalizeLines(options.body).join('\n');

  if (options.breaking && breakingText !== '') footers.push(`BREAKING CHANGE: ${breakingText}`);

  const sections = [header, body, footers.join('\n')].filter((section) => section !== '');

  return {
    header,
    message: `${sections.join('\n\n')}\n`,
    warnings:
      header.length > recommendedHeaderLength
        ? [`Header is ${header.length} characters; many projects limit it to 72.`]
        : [],
  };
}

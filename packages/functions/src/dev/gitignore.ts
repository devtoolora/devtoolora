import { devError } from './shared';

export type GitignoreSection = { label: string; rules: string[] };

export type GitignoreResult = {
  customLineCount: number;
  customRuleCount: number;
  excludedRuleCount: number;
  generatedRuleCount: number;
  selectedTemplateCount: number;
  text: string;
};

export function generateGitignore(
  sections: GitignoreSection[],
  customRules: string[],
  exclusions: string[],
): GitignoreResult {
  const lineCount = sections.reduce(
    (count, section) => count + section.rules.length + 1,
    customRules.length + exclusions.length,
  );

  if (lineCount > 10_000) throw devError('Gitignore input is limited to 10,000 lines.');

  const lines = [
    ...sections.flatMap((section) => [section.label, ...section.rules]),
    ...customRules,
    ...exclusions,
  ];

  if (lines.reduce((length, line) => length + line.length, 0) > 100_000)
    throw devError('Gitignore input is limited to 100,000 UTF-16 units.');
  if (lines.some((line) => /\r|\n|\u0000|[\uD800-\uDFFF]/u.test(line)))
    throw devError(
      'Provide valid Unicode lines without NUL, embedded newlines or unpaired surrogates.',
    );

  const excluded = new Set(exclusions);
  const generatedRules = new Set<string>();
  const output: string[] = [];
  let excludedRuleCount = 0;
  let generatedRuleCount = 0;

  for (const section of sections) {
    const rules: string[] = [];

    for (const rule of section.rules) {
      if (excluded.has(rule)) {
        excludedRuleCount += 1;

        continue;
      }

      // A negation can change the effect of a later repeated positive pattern.
      if (rule.startsWith('!')) generatedRules.clear();
      if (generatedRules.has(rule)) continue;

      rules.push(rule);
      generatedRuleCount += 1;
      generatedRules.add(rule);
      if (rule.startsWith('!')) generatedRules.clear();
    }

    if (rules.length) output.push([`# ${section.label}`, ...rules].join('\n'));
  }

  if (customRules.length) output.push(['# Custom rules', ...customRules].join('\n'));

  return {
    customLineCount: customRules.length,
    customRuleCount: customRules.filter(
      (line) => line.length > 0 && !line.startsWith('#') && !/^[ \t]*$/.test(line),
    ).length,
    excludedRuleCount,
    generatedRuleCount,
    selectedTemplateCount: sections.length,
    text: output.length
      ? `${output.join('\n\n')}\n`
      : '# Select one or more templates or add custom rules.\n',
  };
}

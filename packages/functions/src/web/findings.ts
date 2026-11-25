export type FindingLevel = 'high' | 'info' | 'low' | 'medium';

export type Finding = { level: FindingLevel; message: string };

const levels: FindingLevel[] = ['high', 'medium', 'low', 'info'];

export function sortFindings(findings: Finding[]): Finding[] {
  return [...findings].sort((a, b) => levels.indexOf(a.level) - levels.indexOf(b.level));
}

export function summarizeFindings(findings: Finding[]): string {
  const parts = levels
    .map((level) => [level, findings.filter((finding) => finding.level === level).length] as const)
    .filter(([, count]) => count > 0)
    .map(([level, count]) => `${count} ${level}`);

  return parts.length > 0 ? parts.join(' · ') : 'no findings';
}

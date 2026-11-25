import { FunctionError } from '../errors';
import { sortFindings, type Finding } from './findings';

export type DmarcTag = { explanation: string; name: string; value: string };

export type DmarcBuildOptions = {
  adkim?: string;
  aspf?: string;
  fo?: string;
  pct?: string;
  policy: string;
  rua?: string;
  ruf?: string;
  subdomainPolicy?: string;
};

const policies = ['none', 'quarantine', 'reject'];
const explanations: Record<string, string> = {
  adkim: 'DKIM alignment: r is relaxed (subdomains match), s is strict (exact domain).',
  aspf: 'SPF alignment: r is relaxed (subdomains match), s is strict (exact domain).',
  fo: 'Failure reporting options: 0 all fail, 1 any fail, d DKIM fail, s SPF fail.',
  p: 'Policy for mail that fails DMARC: none, quarantine or reject.',
  pct: 'Percentage of failing mail the policy applies to.',
  rf: 'Format of forensic reports.',
  ri: 'Requested interval in seconds between aggregate reports.',
  rua: 'Where aggregate reports are sent.',
  ruf: 'Where forensic failure reports are sent.',
  sp: 'Policy for subdomains; defaults to p.',
  v: 'Protocol version; must be DMARC1 and the first tag.',
};

function addressFinding(name: string, value: string): Finding | undefined {
  const bad = value
    .split(',')
    .map((entry) => entry.trim().replace(/!\d+[kmgt]?$/i, ''))
    .find((entry) => !/^mailto:/i.test(entry));

  return bad === undefined
    ? undefined
    : { level: 'medium', message: `${name} entry "${bad}" must be a mailto: URI.` };
}

function pctFindings(pct: string | undefined): Finding[] {
  if (pct === undefined) return [];
  if (!(/^\d{1,3}$/.test(pct) && Number(pct) <= 100))
    return [{ level: 'medium', message: `pct "${pct}" must be a whole number from 0 to 100.` }];

  return Number(pct) < 100
    ? [{ level: 'info', message: `Policy applies to only ${pct}% of failing mail.` }]
    : [];
}

const tagGrammars: Record<string, RegExp> = {
  adkim: /^[rs]$/i,
  aspf: /^[rs]$/i,
  fo: /^[01ds](?:\s*:\s*[01ds])*$/i,
  ri: /^\d+$/,
};

function tagValueFindings(tags: DmarcTag[]): Finding[] {
  return tags
    .filter(({ name, value }) => tagGrammars[name] && !tagGrammars[name].test(value))
    .map(({ name, value }) => ({
      level: 'medium',
      message: `${name} "${value}" is not a valid value: ${explanations[name]}`,
    }));
}

export function parseDmarc(record: string): { findings: Finding[]; tags: DmarcTag[] } {
  const tags = record
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part): DmarcTag => {
      const index = part.indexOf('=');
      const name = (index < 0 ? part : part.slice(0, index)).trim().toLowerCase();
      const value = index < 0 ? '' : part.slice(index + 1).trim();

      return {
        explanation: explanations[name] ?? 'Unknown tag; receivers ignore it.',
        name,
        value,
      };
    });
  const value = (name: string) => tags.find((tag) => tag.name === name)?.value;
  const findings: Finding[] = [];
  const policy = value('p')?.toLowerCase();
  const pct = value('pct');

  if (tags[0]?.name !== 'v' || tags[0].value.toLowerCase() !== 'dmarc1')
    findings.push({ level: 'high', message: 'v=DMARC1 must be the first tag.' });
  else if (policy !== undefined && tags[1]?.name !== 'p')
    findings.push({ level: 'high', message: 'p must be the second tag.' });

  if (policy === undefined || !policies.includes(policy))
    findings.push({
      level: 'high',
      message:
        policy === undefined
          ? 'Required p tag is missing.'
          : `p must be none, quarantine or reject, not "${policy}".`,
    });
  else if (policy === 'none')
    findings.push({
      level: 'medium',
      message: 'p=none only monitors; failing mail is still delivered.',
    });

  if (value('rua') === undefined)
    findings.push({
      level: 'medium',
      message: 'No rua tag; you will not receive aggregate reports.',
    });

  (['rua', 'ruf'] as const).forEach((name) => {
    const found = addressFinding(name, value(name) ?? 'mailto:');

    if (found) findings.push(found);
  });

  findings.push(...pctFindings(pct), ...tagValueFindings(tags));

  tags
    .filter((tag) => explanations[tag.name] === undefined)
    .forEach((tag) => findings.push({ level: 'low', message: `Unknown tag "${tag.name}".` }));

  if (value('sp') === undefined)
    findings.push({
      level: 'info',
      message: `No sp tag; subdomains inherit p=${policy ?? 'none'}.`,
    });

  return { findings: sortFindings(findings), tags };
}

function addresses(name: string, value: string | undefined): string | undefined {
  const entries = (value ?? '').split(/[\s,;]+/).filter(Boolean);

  entries.forEach((entry) => {
    if (!/^(?:mailto:)?[^@\s;]+@[^@\s;]+$/i.test(entry))
      throw new FunctionError(
        'INVALID_DMARC',
        `Report address "${entry}" must be an email address.`,
      );
  });

  return entries.length === 0
    ? undefined
    : `${name}=${entries.map((entry) => (/^mailto:/i.test(entry) ? entry : `mailto:${entry}`)).join(',')}`;
}

function choice(
  name: string,
  value: string | undefined,
  allowed: RegExp,
  message: string,
): string | undefined {
  if (!value) return undefined;
  if (!allowed.test(value)) throw new FunctionError('INVALID_DMARC', message);

  return `${name}=${value}`;
}

export function buildDmarc(options: DmarcBuildOptions): { findings: Finding[]; record: string } {
  const pct = options.pct?.trim();

  if (!policies.includes(options.policy))
    throw new FunctionError('INVALID_DMARC', 'Policy must be none, quarantine or reject.');
  if (pct && !(/^\d{1,3}$/.test(pct) && Number(pct) <= 100))
    throw new FunctionError('INVALID_DMARC', 'Percentage must be a whole number from 0 to 100.');

  const record = [
    'v=DMARC1',
    `p=${options.policy}`,
    choice(
      'sp',
      options.subdomainPolicy,
      /^(?:none|quarantine|reject)$/,
      'Subdomain policy must be none, quarantine or reject.',
    ),
    addresses('rua', options.rua),
    addresses('ruf', options.ruf),
    pct ? `pct=${pct}` : undefined,
    choice('adkim', options.adkim, /^[rs]$/, 'DKIM alignment must be r or s.'),
    choice('aspf', options.aspf, /^[rs]$/, 'SPF alignment must be r or s.'),
    choice(
      'fo',
      options.fo,
      /^[01ds](?::[01ds])*$/,
      'Failure options must be 0, 1, d or s separated by colons.',
    ),
  ]
    .filter(Boolean)
    .join('; ');

  return { findings: parseDmarc(record).findings, record };
}

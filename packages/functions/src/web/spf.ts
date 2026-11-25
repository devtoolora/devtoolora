import { FunctionError } from '../errors';
import { ipv4ToInt } from '../network/ipv4';
import { parseIpv6 } from '../network/ipv6';
import { sortFindings, type Finding } from './findings';

export type SpfTerm = {
  explanation: string;
  kind: 'mechanism' | 'modifier';
  lookup: boolean;
  name: string;
  qualifier?: string;
  value?: string;
};

export type SpfBuildOptions = {
  a?: boolean;
  all: string;
  includes?: string;
  ip4?: string;
  ip6?: string;
  mx?: boolean;
  redirect?: string;
};

export const dnsNamePattern = /^[A-Za-z0-9_](?:[A-Za-z0-9_.-]{0,251}[A-Za-z0-9_])?$/;

const mechanisms = ['all', 'include', 'a', 'mx', 'ptr', 'ip4', 'ip6', 'exists'];
const lookupNames = ['include', 'a', 'mx', 'ptr', 'exists', 'redirect'];
const valueRequired = ['include', 'exists', 'ip4', 'ip6', 'redirect'];
const qualifierMeaning: Record<string, string> = {
  '+': 'pass',
  '-': 'fail',
  '?': 'neutral',
  '~': 'softfail',
};

function ipProblem(name: string, value: string): string | undefined {
  const [address = '', prefix, ...rest] = value.split('/');
  const isV4 = name === 'ip4';
  const maxPrefix = isV4 ? 32 : 128;
  let valid = rest.length === 0;

  try {
    if (isV4) ipv4ToInt(address);
    else parseIpv6(address);
  } catch {
    valid = false;
  }

  if (prefix !== undefined && !(/^\d{1,3}$/.test(prefix) && Number(prefix) <= maxPrefix))
    valid = false;

  return valid ? undefined : `${name} "${value}" is not an IPv${isV4 ? '4' : '6'} address or CIDR.`;
}

function explain(name: string, qualifier: string | undefined, value: string | undefined): string {
  const target = value && !value.startsWith('/') ? value : 'the domain';

  switch (name) {
    case 'all':
      return `Matches every other sender and returns ${qualifierMeaning[qualifier ?? '+']}.`;
    case 'include':
      return `Authorizes the senders of ${target} (one DNS lookup).`;
    case 'a':
      return `Authorizes the A and AAAA addresses of ${target} (one DNS lookup).`;
    case 'mx':
      return `Authorizes the mail servers of ${target} (one DNS lookup).`;
    case 'ptr':
      return 'Authorizes hosts by reverse DNS; deprecated and slow (one DNS lookup).';
    case 'exists':
      return `Matches when ${target} resolves to an address (one DNS lookup).`;
    case 'ip4':
      return `Authorizes the IPv4 address or range ${value ?? ''}.`;
    case 'ip6':
      return `Authorizes the IPv6 address or range ${value ?? ''}.`;
    case 'redirect':
      return `Continues with the SPF record of ${target} (one DNS lookup).`;
    case 'exp':
      return `Names a TXT record with the explanation shown for rejected mail (${target}).`;
    default:
      return qualifier === undefined
        ? 'Unknown modifier; receivers ignore it.'
        : 'Unknown mechanism; receivers return permerror for the whole record.';
  }
}

function parseTerm(token: string): SpfTerm {
  const qualifier = /^[+\-~?]/.test(token) ? token.slice(0, 1) : undefined;
  const body = qualifier ? token.slice(1) : token;
  const name = (/^[A-Za-z][A-Za-z0-9_.-]*/.exec(body)?.[0] ?? body).toLowerCase();
  const rest = body.slice(name.length);
  const isModifier = !qualifier && rest.startsWith('=');
  const rawValue = rest.startsWith(':') || rest.startsWith('=') ? rest.slice(1) : rest;
  const value = rawValue === '' ? undefined : rawValue;

  if (isModifier)
    return {
      explanation: explain(name, undefined, value),
      kind: 'modifier',
      lookup: lookupNames.includes(name),
      name,
      value,
    };

  return {
    explanation: explain(name, qualifier ?? '+', value),
    kind: 'mechanism',
    lookup: lookupNames.includes(name),
    name,
    qualifier: qualifier ?? '+',
    value,
  };
}

function termFindings(terms: SpfTerm[]): Finding[] {
  const findings: Finding[] = [];

  terms.forEach((term) => {
    const known =
      term.kind === 'mechanism'
        ? mechanisms.includes(term.name)
        : ['redirect', 'exp'].includes(term.name);

    if (!known)
      findings.push(
        term.kind === 'mechanism'
          ? {
              level: 'high',
              message: `Unknown mechanism "${term.name}"; receivers return permerror for the whole record.`,
            }
          : {
              level: 'low',
              message: `Unknown modifier "${term.name}"; receivers ignore it.`,
            },
      );
    else if (term.name === 'exp')
      findings.push({ level: 'low', message: 'exp= is rarely used and many receivers ignore it.' });
    else if (valueRequired.includes(term.name) && !term.value)
      findings.push({ level: 'medium', message: `${term.name} needs a value.` });
    else if (term.name === 'ip4' || term.name === 'ip6') {
      const problem = ipProblem(term.name, term.value ?? '');

      if (problem) findings.push({ level: 'medium', message: problem });
    }

    if (term.name === 'ptr')
      findings.push({
        level: 'medium',
        message: 'ptr is deprecated and slow; use ip4, ip6 or a instead.',
      });
  });

  return findings;
}

export function parseSpf(record: string): {
  findings: Finding[];
  lookups: number;
  terms: SpfTerm[];
} {
  const [version, ...tokens] = record.trim().split(/\s+/);

  if (version?.toLowerCase() !== 'v=spf1')
    throw new FunctionError('INVALID_SPF', 'SPF record must start with v=spf1.');

  const terms = tokens.map(parseTerm);
  const lookups = terms.filter((term) => term.lookup).length;
  const findings = termFindings(terms);
  const allIndex = terms.findIndex((term) => term.name === 'all' && term.kind === 'mechanism');
  const all = terms[allIndex];

  for (const name of ['redirect', 'exp'])
    if (terms.filter((term) => term.kind === 'modifier' && term.name === name).length > 1)
      findings.push({
        level: 'high',
        message: `${name}= appears more than once; receivers return permerror.`,
      });

  if (lookups > 10)
    findings.push({
      level: 'high',
      message: `${lookups} DNS lookups; SPF allows at most 10, so receivers return permerror.`,
    });
  if (all?.qualifier === '+')
    findings.push({ level: 'high', message: '+all authorizes every sender on the internet.' });
  if (all?.qualifier === '?')
    findings.push({ level: 'medium', message: '?all is neutral; it gives receivers no policy.' });
  if (!all && !terms.some((term) => term.name === 'redirect'))
    findings.push({
      level: 'medium',
      message: 'No "all" mechanism and no redirect; the record never ends with a decision.',
    });
  if (allIndex >= 0 && terms.slice(allIndex + 1).some((term) => term.kind === 'mechanism'))
    findings.push({ level: 'medium', message: 'Terms after "all" are ignored.' });
  if (all && terms.some((term) => term.name === 'redirect'))
    findings.push({
      level: 'info',
      message: 'redirect is ignored when "all" is present; "all" wins.',
    });
  if (record.trim().length > 255)
    findings.push({
      level: 'info',
      message: 'Record is over 255 characters; publish it as several quoted strings.',
    });

  return { findings: sortFindings(findings), lookups, terms };
}

function lines(value: string | undefined): string[] {
  return (value ?? '').split(/[\s,]+/).filter(Boolean);
}

function checkedNames(name: string, values: string[]): string[] {
  values.forEach((value) => {
    if (!dnsNamePattern.test(value))
      throw new FunctionError('INVALID_SPF', `${name} "${value}" is not a domain name.`);
  });

  return values;
}

function checkedIps(name: 'ip4' | 'ip6', values: string[]): string[] {
  values.forEach((value) => {
    if (ipProblem(name, value))
      throw new FunctionError(
        'INVALID_SPF',
        `${name} "${value}" is not an IPv${name === 'ip4' ? '4' : '6'} address or CIDR.`,
      );
  });

  return values.map((value) => `${name}:${value}`);
}

export function buildSpf(options: SpfBuildOptions): {
  findings: Finding[];
  lookups: number;
  record: string;
} {
  if (!['-all', '~all', '?all'].includes(options.all))
    throw new FunctionError('INVALID_SPF', 'All qualifier must be -all, ~all or ?all.');

  const redirect = options.redirect?.trim();
  const parts = [
    'v=spf1',
    ...checkedNames('include', lines(options.includes)).map((domain) => `include:${domain}`),
    ...checkedIps('ip4', lines(options.ip4)),
    ...checkedIps('ip6', lines(options.ip6)),
    ...(options.a ? ['a'] : []),
    ...(options.mx ? ['mx'] : []),
    // "all" would make redirect dead (RFC 7208), so a redirect replaces it.
    ...(redirect ? [`redirect=${checkedNames('redirect', [redirect])[0]}`] : [options.all]),
  ];
  const record = parts.join(' ');
  const { findings, lookups } = parseSpf(record);

  return { findings, lookups, record };
}

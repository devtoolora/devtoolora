import { FunctionError } from '../errors';
import { sortFindings } from './findings';
import type { Finding } from './findings';

export type RedirectTarget = 'apache' | 'netlify' | 'nginx' | 'vercel';

export type RedirectRule = {
  from: string;
  line: number;
  splat: boolean;
  status: number;
  to: string;
};

const maxLines = 10_000;
const maxLineLength = 2048;
const statuses = [301, 302, 307, 308];
const targets: RedirectTarget[] = ['nginx', 'apache', 'netlify', 'vercel'];
const separator = /\s*(?:->|→|,|\t)\s*|\s+/;
const unsafe = /[;{}"\\]/;

function redirectError(message: string): FunctionError {
  return new FunctionError('INVALID_REDIRECTS', message);
}

function parseStatus(value: string, prefix: string): number {
  const status = Number(value);

  if (!statuses.includes(status)) {
    throw redirectError(`${prefix}status must be 301, 302, 307 or 308.`);
  }

  return status;
}

function parseLine(
  raw: string,
  line: number,
  defaultStatus: number,
): { explicit: boolean; rule: RedirectRule } {
  const prefix = `Line ${line}: `;
  const parts = raw.split(separator).filter(Boolean);

  if (parts.length < 2 || parts.length > 3) {
    throw redirectError(`${prefix}expected "from to [status]".`);
  }

  const [from = '', rawTo = '', rawStatus] = parts;

  if (!from.startsWith('/')) {
    throw redirectError(`${prefix}from "${from}" must start with "/".`);
  }

  if (from.includes('?')) {
    throw redirectError(`${prefix}query strings in from are unsupported.`);
  }

  const splat = from.endsWith('/*');

  if (/[()[\]^$+*|\\]/.test(splat ? from.slice(0, -2) : from)) {
    throw redirectError(
      `${prefix}from "${from}" may only end in "/*"; other patterns are unsupported.`,
    );
  }

  for (const [name, value] of [
    ['from', from],
    ['to', rawTo],
  ] as const) {
    if (unsafe.test(value)) {
      throw redirectError(`${prefix}${name} contains a character that is not allowed: ; { } ".`);
    }
  }

  if (!rawTo.startsWith('/') && !/^https?:\/\/\S+$/i.test(rawTo)) {
    throw redirectError(`${prefix}to "${rawTo}" must be a path or an absolute http(s) URL.`);
  }

  const to = rawTo.replace(/\$1/g, ':splat');

  if (/:splat\b/.test(to) && !splat) {
    throw redirectError(`${prefix}to uses a wildcard but from does not end in "/*".`);
  }

  const status = rawStatus === undefined ? defaultStatus : parseStatus(rawStatus, prefix);

  return { explicit: rawStatus !== undefined, rule: { from, line, splat, status, to } };
}

export function parseRedirectRules(
  value: string,
  defaultStatus: string,
): { findings: Finding[]; rules: RedirectRule[] } {
  const fallback = parseStatus(defaultStatus, 'Default ');
  const lines = value.split(/\r?\n/);
  const findings: Finding[] = [];
  const rules: RedirectRule[] = [];
  const seen = new Set<string>();
  let used = 0;

  lines.forEach((raw, index) => {
    if (raw.length > maxLineLength) {
      throw redirectError(`Line ${index + 1} exceeds 2,048 characters.`);
    }

    used += raw.trim() ? 1 : 0;
  });

  if (used > maxLines) {
    throw redirectError('Redirect rules exceed 10,000 lines.');
  }

  lines.forEach((raw, index) => {
    const text = raw.trim();

    if (!text || text.startsWith('#')) {
      return;
    }

    const { explicit, rule } = parseLine(text, index + 1, fallback);

    if (seen.has(rule.from)) {
      findings.push({
        level: 'medium',
        message: `Line ${rule.line}: duplicate from "${rule.from}"; the first rule wins.`,
      });

      return;
    }

    seen.add(rule.from);

    if (rule.from === rule.to) {
      findings.push({
        level: 'high',
        message: `Line ${rule.line}: from "${rule.from}" redirects to itself.`,
      });
    }

    findings.push(...targetFindings(rule));

    if (explicit && rule.status !== fallback) {
      findings.push({
        level: 'info',
        message: `Line ${rule.line}: status ${rule.status} differs from the default ${fallback}.`,
      });
    }

    rules.push(rule);
  });

  if (rules.length === 0 && findings.length === 0) {
    throw redirectError('Redirect rules input is required.');
  }

  return { findings: [...findings, ...findChains(rules)], rules };
}

function targetFindings({ from, line, splat, to }: RedirectRule): Finding[] {
  const findings: Finding[] = [];

  if (splat && to.startsWith(from.slice(0, -1))) {
    findings.push({
      level: 'high',
      message: `Line ${line}: wildcard ${from} matches its own target ${to}, so it loops.`,
    });
  }

  if (to.includes('$')) {
    findings.push({
      level: 'medium',
      message: `Line ${line}: to "${to}" has a $, which nginx reads as a variable and Apache as a back-reference.`,
    });
  }

  return findings;
}

// shortcut: walks at most 32 hops, more than any browser follows; a longer loop reads as chains.
function loopOf(rule: RedirectRule, byFrom: Map<string, RedirectRule>): RedirectRule[] | undefined {
  const path = [rule];
  let next = byFrom.get(rule.to);

  while (next && next !== rule && path.length < 32) {
    if (path.includes(next)) return undefined;

    path.push(next);
    next = byFrom.get(next.to);
  }

  return next === rule && path.length > 1 ? path : undefined;
}

function findChains(rules: RedirectRule[]): Finding[] {
  const findings: Finding[] = [];

  const byFrom = new Map(rules.map((rule) => [rule.from, rule]));

  for (const rule of rules) {
    const next = byFrom.get(rule.to);
    const loop = loopOf(rule, byFrom);

    if (loop) {
      if (loop.every((member) => rule.line <= member.line)) {
        const hops = [...loop.map((member) => member.from), rule.from];

        findings.push({ level: 'high', message: `Loop ${hops.join(' → ')}.` });
      }
    } else if (next && next !== rule && next.to !== next.from) {
      findings.push({
        level: 'low',
        message: `Chain ${rule.from} → ${rule.to} → ${next.to}; point ${rule.from} at ${next.to} directly.`,
      });
    }
  }

  return findings;
}

function prefixOf(rule: RedirectRule): string {
  return escapeDots(rule.from.slice(0, -1));
}

function escapeDots(value: string): string {
  return value.replace(/\./g, '\\.');
}

function renderVercel(rules: RedirectRule[]): string {
  const redirects = rules.map((rule) => {
    const entry = {
      destination: rule.to.replace(/:splat\b/g, ':path*'),
      source: rule.splat ? `${rule.from.slice(0, -1)}:path*` : rule.from,
    };

    if (rule.status === 308 || rule.status === 307) {
      return { ...entry, permanent: rule.status === 308 };
    }

    return { ...entry, statusCode: rule.status };
  });

  return `${JSON.stringify({ redirects }, null, 2)}\n`;
}

export function renderRedirects(rules: RedirectRule[], target: RedirectTarget): string {
  if (target === 'vercel') {
    return renderVercel(rules);
  }

  return rules
    .map((rule) => {
      const to = rule.to.replace(/:splat\b/g, '$1');

      switch (target) {
        case 'netlify':
          return `${rule.from} ${rule.to} ${rule.status}\n`;
        case 'apache':
          return rule.splat
            ? `RedirectMatch ${rule.status} ^${prefixOf(rule)}(.*)$ ${to}\n`
            : `RedirectMatch ${rule.status} ^${escapeDots(rule.from)}$ ${to}\n`;
        default:
          return `location ${rule.splat ? `~ ^${prefixOf(rule)}(.*)$` : `= ${rule.from}`} {\n  return ${rule.status} ${to};\n}\n`;
      }
    })
    .join('');
}

export function generateRedirects(
  value: string,
  options: { status: string; target: string },
): { count: number; findings: Finding[]; text: string } {
  const target = targets.find((candidate) => candidate === options.target);

  if (!target) {
    throw redirectError('Target must be nginx, apache, netlify or vercel.');
  }

  const { findings, rules } = parseRedirectRules(value, options.status);

  return {
    count: rules.length,
    findings: sortFindings(findings),
    text: renderRedirects(rules, target),
  };
}

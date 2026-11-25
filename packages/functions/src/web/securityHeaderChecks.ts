import { FunctionError } from '../errors';
import { analyzeCsp, type CspReport } from './csp';
import type { ParsedCookie } from './cookies';

export type HeaderCheckStatus = 'fail' | 'info' | 'pass' | 'warn';

export type HeaderCheck = {
  graded: boolean;
  header: string;
  message: string;
  status: HeaderCheckStatus;
  value?: string;
};

export type HeaderLookup = (name: string) => string | undefined;

const oneYear = 31_536_000;

function check(
  header: string,
  graded: boolean,
  status: HeaderCheckStatus,
  message: string,
  value?: string,
): HeaderCheck {
  return { graded, header, message, status, ...(value === undefined ? {} : { value }) };
}

export function checkHsts(get: HeaderLookup): HeaderCheck {
  const name = 'Strict-Transport-Security';
  const value = get(name);

  if (value === undefined) return check(name, true, 'fail', 'Header is missing.');

  const maxAge = /(?:^|;)\s*max-age\s*=\s*"?(\d+)/i.exec(value)?.[1];
  const age = maxAge === undefined ? 0 : Number(maxAge);
  const subdomains = /(?:^|;)\s*includeSubDomains\s*(?:;|$)/i.test(value);
  const preload = /(?:^|;)\s*preload\s*(?:;|$)/i.test(value);
  const note = preload ? ' preload is set.' : '';

  if (age === 0) return check(name, true, 'fail', 'max-age is missing or 0.', value);
  if (age < oneYear)
    return check(
      name,
      true,
      'warn',
      `max-age ${age} is below 31,536,000 (one year).${note}`,
      value,
    );
  if (!subdomains) return check(name, true, 'warn', `includeSubDomains is missing.${note}`, value);

  return check(name, true, 'pass', `max-age ${age} with includeSubDomains.${note}`, value);
}

type CspParse = { empty: boolean; error: string } | { report: CspReport };

function parseCsp(value: string): CspParse {
  try {
    return { report: analyzeCsp(value) };
  } catch (error) {
    if (!(error instanceof FunctionError)) throw error;

    return { empty: value.trim() === '', error: error.message };
  }
}

export function checkCsp(get: HeaderLookup): HeaderCheck {
  const name = 'Content-Security-Policy';
  const value = get(name);

  if (value === undefined) {
    return get('Content-Security-Policy-Report-Only') === undefined
      ? check(name, true, 'fail', 'Header is missing.')
      : check(name, true, 'fail', 'Only a report-only policy is set; nothing is enforced.');
  }

  const parsed = parseCsp(value);

  if ('error' in parsed)
    return check(name, true, parsed.empty ? 'fail' : 'warn', parsed.error, value);

  const high = parsed.report.findings.find((finding) => finding.level === 'high');

  return high
    ? check(name, true, 'warn', high.message, value)
    : check(name, true, 'pass', 'Policy has no high findings.', value);
}

export function checkNosniff(get: HeaderLookup): HeaderCheck {
  const name = 'X-Content-Type-Options';
  const value = get(name);

  if (value === undefined) return check(name, true, 'fail', 'Header is missing.');

  // Fetch reads only the first value of the list.
  return value.split(',')[0]?.trim().toLowerCase() === 'nosniff'
    ? check(name, true, 'pass', 'nosniff is set.', value)
    : check(name, true, 'fail', 'Value must be nosniff.', value);
}

export function checkFraming(get: HeaderLookup): HeaderCheck {
  const name = 'Framing';
  const csp = get('Content-Security-Policy');
  const frame = get('X-Frame-Options');
  const option = frame?.trim().toUpperCase();

  const parsed = csp === undefined ? undefined : parseCsp(csp);
  const ancestors =
    parsed && 'report' in parsed
      ? parsed.report.directives.find((directive) => directive.name === 'frame-ancestors')
      : undefined;

  if (ancestors) {
    const open = ancestors.sources.find((source) =>
      /^(?:\*|[a-z][a-z0-9+.-]*:(?:\/\/\*)?)$/i.test(source),
    );

    return open
      ? check(name, true, 'fail', `CSP frame-ancestors ${open} lets any site frame the page.`)
      : check(name, true, 'pass', 'CSP frame-ancestors limits framing.');
  }

  if (option === 'DENY' || option === 'SAMEORIGIN')
    return check(name, true, 'pass', `X-Frame-Options is ${option}.`, frame);

  if (option?.startsWith('ALLOW-FROM'))
    return check(name, true, 'warn', 'ALLOW-FROM is obsolete and ignored by browsers.', frame);

  return check(name, true, 'fail', 'No CSP frame-ancestors and no X-Frame-Options.', frame);
}

export function checkReferrer(get: HeaderLookup): HeaderCheck {
  const name = 'Referrer-Policy';
  const value = get(name);

  if (value === undefined) return check(name, true, 'fail', 'Header is missing.');

  const last = value.split(',').pop()?.trim().toLowerCase() ?? '';
  const weak = ['no-referrer-when-downgrade', 'unsafe-url'].find((item) => item === last);

  return weak
    ? check(name, true, 'warn', `${weak} leaks full URLs to other origins.`, value)
    : check(name, true, 'pass', 'Policy limits the Referer header.', value);
}

export function checkMissingInfo(get: HeaderLookup, name: string, graded: boolean): HeaderCheck {
  const value = get(name);

  const missing = graded
    ? 'Header is not set; counts as missing for the grade.'
    : 'Header is not set.';

  return value === undefined
    ? check(name, graded, 'info', missing)
    : check(name, graded, 'pass', 'Header is set.', value);
}

export function checkLegacy(get: HeaderLookup): HeaderCheck[] {
  const checks: HeaderCheck[] = [];
  const xss = get('X-XSS-Protection');

  if (xss !== undefined) {
    checks.push(
      xss.trim().startsWith('0')
        ? check('X-XSS-Protection', false, 'pass', 'The filter is disabled.', xss)
        : check('X-XSS-Protection', false, 'warn', 'Header is deprecated; use 0 or a CSP.', xss),
    );
  }

  for (const name of ['Server', 'X-Powered-By', 'X-AspNet-Version']) {
    const value = get(name);

    if (value === undefined) continue;

    checks.push(
      /\d+\.\d+/.test(value)
        ? check(name, false, 'warn', 'Value discloses a version number.', value)
        : check(name, false, 'pass', 'No version number disclosed.', value),
    );
  }

  return checks;
}

export function checkCookies(
  cookies: ParsedCookie[],
  failed: string[],
  get: HeaderLookup,
): HeaderCheck[] {
  if (cookies.length === 0 && failed.length === 0) return [];

  const checks: HeaderCheck[] = failed.map((message) =>
    check('Set-Cookie', false, 'warn', message),
  );

  for (const { findings, name } of cookies) {
    for (const finding of findings) {
      if (finding.level === 'high' || finding.level === 'medium')
        checks.push(check('Set-Cookie', false, 'warn', `${name}: ${finding.message}`));
    }
  }

  if (checks.length === 0)
    checks.push(check('Set-Cookie', false, 'pass', 'No high or medium cookie findings.'));

  const cache = get('Cache-Control');

  if (cache === undefined || !/\b(?:no-store|private)\b/i.test(cache))
    checks.push(
      check(
        'Cache-Control',
        false,
        'info',
        'Set-Cookie without no-store or private may be cached.',
        cache,
      ),
    );

  return checks;
}

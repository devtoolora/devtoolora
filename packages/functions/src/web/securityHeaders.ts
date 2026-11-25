import { FunctionError } from '../errors';
import { parseCookies, type ParsedCookie } from './cookies';
import { sortFindings, type Finding } from './findings';
import { parseHttpHeaders } from './operations';
import {
  checkCookies,
  checkCsp,
  checkFraming,
  checkHsts,
  checkLegacy,
  checkMissingInfo,
  checkNosniff,
  checkReferrer,
  type HeaderCheck,
  type HeaderCheckStatus,
} from './securityHeaderChecks';

export type { HeaderCheck, HeaderCheckStatus };

export type SecurityHeadersReport = {
  checks: HeaderCheck[];
  cookieFindings: Finding[];
  grade: string;
  gradedPresent: number;
  warnings: number;
};

const grades = ['F', 'F', 'E', 'D', 'C', 'B', 'A'];

export function analyzeSecurityHeaders(value: string): SecurityHeadersReport {
  const parsed = parseHttpHeaders(value);

  if (parsed.startLine && !parsed.startLine.startsWith('HTTP/'))
    throw new FunctionError('INVALID_WEB_INPUT', 'Paste response headers, not a request.');

  const get = (name: string): string | undefined => {
    const found = parsed.headers[name.toLowerCase()];

    return Array.isArray(found) ? found[0] : found;
  };

  const cookieLines = parsed.rawHeaders
    .filter(({ name }) => name.toLowerCase() === 'set-cookie')
    .map(({ value: line }) => `Set-Cookie: ${line}`);
  const cookies: ParsedCookie[] = [];
  const failed: string[] = [];

  for (const line of cookieLines) {
    try {
      cookies.push(...parseCookies(line).cookies);
    } catch (error) {
      if (!(error instanceof FunctionError)) throw error;

      failed.push(`${line.slice(0, 60)}: ${error.message}`);
    }
  }

  const checks = [
    checkHsts(get),
    checkCsp(get),
    checkNosniff(get),
    checkFraming(get),
    checkReferrer(get),
    checkMissingInfo(get, 'Permissions-Policy', true),
    checkMissingInfo(get, 'Cross-Origin-Opener-Policy', false),
    checkMissingInfo(get, 'Cross-Origin-Resource-Policy', false),
    checkMissingInfo(get, 'Cross-Origin-Embedder-Policy', false),
    ...checkLegacy(get),
    ...checkCookies(cookies, failed, get),
  ];
  const gradedPresent = checks.filter(
    (item) => item.graded && (item.status === 'pass' || item.status === 'warn'),
  ).length;
  const warnings = checks.filter((item) => item.status === 'warn').length;

  return {
    checks,
    cookieFindings: sortFindings(cookies.flatMap((cookie) => cookie.findings)),
    grade: gradedPresent === 6 && warnings === 0 ? 'A+' : (grades[gradedPresent] ?? 'F'),
    gradedPresent,
    warnings,
  };
}

function table(checks: HeaderCheck[]): string[] {
  return checks.map(({ header, message, status }) => `${header} | ${status} | ${message}`);
}

export function renderSecurityHeadersReport(report: SecurityHeadersReport): string {
  const graded = report.checks.filter((item) => item.graded);
  const other = report.checks.filter((item) => !item.graded);
  const hasCookies = report.checks.some((item) => item.header === 'Set-Cookie');
  const found = report.cookieFindings.map(({ level, message }) => `[${level}] ${message}`);
  const cookies = hasCookies ? found : ['No Set-Cookie headers.'];

  if (hasCookies && found.length === 0) cookies.push('No cookie findings.');

  return [
    `Grade: ${report.grade} (${report.gradedPresent} of 6 graded headers, ${report.warnings} ${report.warnings === 1 ? 'warning' : 'warnings'})`,
    '',
    '# Graded headers',
    'header | status | message',
    ...table(graded),
    '',
    '# Other checks',
    ...(other.length > 0 ? table(other) : ['None.']),
    '',
    '# Cookies',
    ...cookies,
  ].join('\n');
}

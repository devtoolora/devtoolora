import { FunctionError } from '../errors';
import { sortFindings, type Finding } from './findings';

export type CspDirective = { name: string; sources: string[] };

export type CspReport = {
  directives: CspDirective[];
  findings: Finding[];
  header: string;
  meta: string;
  policy: string;
  reportOnly: boolean;
};

const maxChars = 65_536;
const maxDirectives = 100;
const maxSources = 500;

const knownDirectives = new Set([
  'base-uri',
  'child-src',
  'connect-src',
  'default-src',
  'font-src',
  'form-action',
  'frame-ancestors',
  'frame-src',
  'img-src',
  'manifest-src',
  'media-src',
  'object-src',
  'report-to',
  'report-uri',
  'require-trusted-types-for',
  'sandbox',
  'script-src',
  'script-src-attr',
  'script-src-elem',
  'style-src',
  'style-src-attr',
  'style-src-elem',
  'trusted-types',
  'upgrade-insecure-requests',
  'webrtc',
  'worker-src',
]);
const deprecatedDirectives = new Set([
  'block-all-mixed-content',
  'navigate-to',
  'plugin-types',
  'prefetch-src',
  'referrer',
]);
const keywordSources = new Set([
  "'inline-speculation-rules'",
  "'none'",
  "'report-sample'",
  "'self'",
  "'strict-dynamic'",
  "'unsafe-eval'",
  "'unsafe-hashes'",
  "'unsafe-inline'",
  "'wasm-unsafe-eval'",
]);
const nonFetchDirectives = new Set([
  'base-uri',
  'form-action',
  'frame-ancestors',
  'report-to',
  'report-uri',
  'require-trusted-types-for',
  'sandbox',
  'trusted-types',
  'upgrade-insecure-requests',
  'webrtc',
]);
const metaIgnored = ['frame-ancestors', 'report-uri', 'report-to', 'sandbox'];
const broadSources = new Set(['*', 'data:', 'http:', 'https:']);
const unquotedKeyword =
  /^(?:none|report-sample|self|strict-dynamic|unsafe-eval|unsafe-hashes|unsafe-inline|wasm-unsafe-eval)$/i;
const metaEntities: Record<string, string> = {
  '&#39;': "'",
  '&amp;': '&',
  '&apos;': "'",
  '&quot;': '"',
};

function cspError(message: string): FunctionError {
  return new FunctionError('INVALID_CSP', message);
}

function extractValue(input: string): { isMeta: boolean; reportOnly: boolean; value: string } {
  for (const [tag] of input.matchAll(/<meta\b[^>]*>/gi)) {
    if (!/http-equiv\s*=\s*["']?content-security-policy["'\s>/]/i.test(tag)) {
      continue;
    }

    const content = /\bcontent\s*=\s*(?:"([^"]*)"|'([^']*)')/i.exec(tag);

    if (content) {
      return {
        isMeta: true,
        reportOnly: false,
        value: (content[1] ?? content[2] ?? '').replace(
          /&(?:#39|amp|apos|quot);/gi,
          (entity) => metaEntities[entity.toLowerCase()] ?? entity,
        ),
      };
    }
  }

  const header = /^\s*content-security-policy(-report-only)?\s*:/i.exec(input);

  return {
    isMeta: false,
    reportOnly: Boolean(header?.[1]),
    value: header ? input.slice(header[0].length) : input,
  };
}

function isMalformed(source: string): boolean {
  return /[^\x21-\x7e]/.test(source) || (source.match(/'/g)?.length ?? 0) % 2 === 1;
}

function normalizeSource(source: string): string {
  const lower = source.toLowerCase();

  return keywordSources.has(lower) || /^[a-z][a-z0-9+.-]*:$/i.test(source) ? lower : source;
}

function parseDirectives(value: string, findings: Finding[]): CspDirective[] {
  if (value.includes(',')) {
    findings.push({
      level: 'medium',
      message:
        'A comma separates policies, and browsers enforce each one; this report reads them as one policy.',
    });
  }

  const segments = value
    .split(/[;\n]/)
    .map((segment) => segment.trim())
    .filter(Boolean);

  if (segments.length > maxDirectives) {
    throw cspError(`CSP input exceeds ${maxDirectives} directives.`);
  }

  const directives: CspDirective[] = [];

  for (const segment of segments) {
    const [rawName = '', ...rawSources] = segment.split(/\s+/);
    const name = rawName.toLowerCase();

    if (rawSources.length > maxSources) {
      throw cspError(`Directive "${name}" exceeds ${maxSources} sources.`);
    }

    if (directives.some((directive) => directive.name === name)) {
      findings.push({
        level: 'medium',
        message: `Duplicate directive "${name}"; browsers keep the first.`,
      });

      continue;
    }

    if (deprecatedDirectives.has(name)) {
      findings.push({ level: 'low', message: `Directive "${name}" is deprecated.` });
    } else if (!knownDirectives.has(name)) {
      findings.push({ level: 'medium', message: `Unknown directive "${name}".` });
    }

    for (const source of rawSources.filter(isMalformed)) {
      findings.push({ level: 'medium', message: `Malformed source "${source}" in "${name}".` });
    }

    if (!nonFetchDirectives.has(name)) {
      for (const source of rawSources.filter((item) => unquotedKeyword.test(item))) {
        findings.push({
          level: 'medium',
          message: `Source "${source}" in "${name}" is read as a host; write '${source.toLowerCase()}'.`,
        });
      }
    }

    directives.push({ name, sources: rawSources.map(normalizeSource) });
  }

  return directives;
}

const hasNonceOrHash = (sources: string[]): boolean =>
  sources.some((source) => /^'(nonce-|sha(256|384|512)-)/i.test(source));

function scriptObjectFindings(
  list: string[],
  label: string,
  isScript: boolean,
  findings: Finding[],
): void {
  const broad = list.filter(
    (item) => broadSources.has(item) || /^[a-z][a-z0-9+.-]*:\/\/\*$/i.test(item),
  );
  const hasHostWildcard =
    isScript && list.some((source) => /^([a-z][a-z0-9+.-]*:\/\/)?\*\./i.test(source));
  const isStrictDynamic = isScript && list.includes("'strict-dynamic'");

  // CSP3 §8.2: 'strict-dynamic' makes browsers skip host and scheme sources.
  if (isStrictDynamic && (broad.length > 0 || hasHostWildcard)) {
    findings.push({
      level: 'info',
      message: `Host and scheme sources in ${label} are ignored because of 'strict-dynamic'.`,
    });
  }

  for (const source of isStrictDynamic ? [] : broad) {
    findings.push({
      level: 'high',
      message: `${label} allows ${source}, which lets any matching ${isScript ? 'script' : 'plugin content'} load.`,
    });
  }

  if (isScript && list.includes("'unsafe-inline'")) {
    findings.push(
      hasNonceOrHash(list)
        ? {
            level: 'info',
            message: `'unsafe-inline' in ${label} is ignored by CSP3 browsers because a nonce or hash is present.`,
          }
        : { level: 'high', message: `${label} allows 'unsafe-inline', so injected scripts run.` },
    );
  }

  if (isScript && list.includes("'unsafe-eval'")) {
    findings.push({ level: 'high', message: `${label} allows 'unsafe-eval'.` });
  }

  if (isStrictDynamic && !hasNonceOrHash(list)) {
    findings.push({
      level: 'high',
      message: `'strict-dynamic' in ${label} is ineffective without a nonce or hash.`,
    });
  }

  if (hasHostWildcard && !isStrictDynamic) {
    findings.push({
      level: 'low',
      message: `${label} uses a host wildcard such as *.example.com.`,
    });
  }
}

function policyFindings(directives: CspDirective[], reportOnly: boolean, findings: Finding[]) {
  const get = (name: string) => directives.find((directive) => directive.name === name);
  const script = get('script-src') ?? get('default-src');
  const object = get('object-src') ?? get('default-src');
  // The -elem and -attr directives take precedence over script-src (CSP3 §6.8.3).
  const scripts = [script, get('script-src-elem'), get('script-src-attr')];

  for (const directive of scripts) {
    if (directive) scriptObjectFindings(directive.sources, directive.name, true, findings);
  }

  if (object && object.name !== script?.name) {
    scriptObjectFindings(object.sources, object.name, false, findings);
  }

  const styles = [
    get('style-src') ?? get('default-src'),
    get('style-src-elem'),
    get('style-src-attr'),
  ];

  for (const style of new Set(styles)) {
    if (style?.sources.includes("'unsafe-inline'")) {
      findings.push({ level: 'medium', message: `${style.name} allows 'unsafe-inline'.` });
    }
  }

  for (const { name, sources } of directives) {
    if (
      sources.includes('http:') &&
      name !== object?.name &&
      !scripts.some((directive) => directive?.name === name)
    ) {
      findings.push({ level: 'low', message: `${name} allows insecure http: sources.` });
    }

    if (name === 'report-uri') {
      findings.push({ level: 'low', message: 'report-uri is deprecated; use report-to.' });
    }

    if (sources.length === 0 && !nonFetchDirectives.has(name) && knownDirectives.has(name)) {
      findings.push({ level: 'info', message: `${name} has no sources, which equals 'none'.` });
    }
  }

  if (!get('default-src') && !get('script-src')) {
    findings.push({
      level: 'medium',
      message: 'No default-src or script-src; scripts are not restricted.',
    });
  }

  if (reportOnly) {
    findings.push({ level: 'info', message: 'Report-only policy; nothing is blocked.' });
  } else {
    missingDirectiveFindings(get, findings);
  }
}

function missingDirectiveFindings(
  get: (name: string) => CspDirective | undefined,
  findings: Finding[],
): void {
  if (!get('object-src') && !get('default-src')) {
    findings.push({
      level: 'high',
      message: "No object-src or default-src; set object-src 'none'.",
    });
  }

  if (!get('base-uri')) {
    findings.push({ level: 'medium', message: "No base-uri; set base-uri 'none' or 'self'." });
  }

  if (!get('frame-ancestors')) {
    findings.push({ level: 'low', message: 'No frame-ancestors; the page can be framed.' });
  }

  if (!get('form-action')) {
    findings.push({ level: 'low', message: 'No form-action; forms can post anywhere.' });
  }
}

export function analyzeCsp(input: string): CspReport {
  if (input.trim() === '') {
    throw cspError('CSP input is required.');
  }

  if (input.length > maxChars) {
    throw cspError('CSP input exceeds 65,536 characters.');
  }

  const { isMeta, reportOnly, value } = extractValue(input);
  const findings: Finding[] = [];
  const directives = parseDirectives(value, findings);
  const policy = directives.map(({ name, sources }) => [name, ...sources].join(' ')).join('; ');
  const headerName = reportOnly ? 'Content-Security-Policy-Report-Only' : 'Content-Security-Policy';

  policyFindings(directives, reportOnly, findings);

  if (isMeta) {
    for (const name of metaIgnored) {
      if (directives.some((directive) => directive.name === name)) {
        findings.push({
          level: name === 'frame-ancestors' ? 'medium' : 'info',
          message: `Directive "${name}" is ignored in a <meta> policy.`,
        });
      }
    }
  }

  return {
    directives,
    findings: sortFindings(findings),
    header: `${headerName}: ${policy}`,
    meta: `<meta http-equiv="Content-Security-Policy" content="${policy.replaceAll('"', '&quot;')}">`,
    policy,
    reportOnly,
  };
}

export function cspMetaIgnored(report: CspReport): string[] {
  return report.directives.map(({ name }) => name).filter((name) => metaIgnored.includes(name));
}

export function renderCspReport(report: CspReport): string {
  const findings = report.findings.length
    ? report.findings.map(({ level, message }) => `[${level.toUpperCase()}] ${message}`)
    : ['No findings.'];
  const table = report.directives.map(({ name, sources }) => [name, ...sources].join(' '));

  return [
    '# Policy',
    report.header,
    '',
    '# Directives',
    ...table,
    '',
    '# Findings',
    ...findings,
  ].join('\n');
}

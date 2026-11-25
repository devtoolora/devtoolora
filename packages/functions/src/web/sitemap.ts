import { XmlElement } from '@rgrove/parse-xml';
import { FunctionError } from '../errors';
import { parseXmlDocument } from '../format/xmlDocument';
import { childElements, localName } from '../format/xmlElements';
import type { Finding } from './findings';

export type SitemapReport = {
  entries: number;
  errors: string[];
  hosts: string[];
  kind: 'sitemapindex' | 'urlset';
  warnings: string[];
};

const maxEntries = 50_000;
const maxInput = 5_000_000;
const maxLoc = 2048;
const namespace = 'http://www.sitemaps.org/schemas/sitemap/0.9';
const changefreqs = ['always', 'hourly', 'daily', 'weekly', 'monthly', 'yearly', 'never'];
const w3cDate = /^\d{4}(-\d{2}(-\d{2}(T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2}))?)?)?$/;
const changefreqMessage = `must be one of ${changefreqs.join(', ')}.`;

function sitemapError(message: string): FunctionError {
  return new FunctionError('INVALID_SITEMAP', message);
}

function isW3cDate(value: string): boolean {
  if (!w3cDate.test(value) || Number.isNaN(Date.parse(value))) return false;

  const [year = 0, month = 1, day = 1] = value.slice(0, 10).split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));

  return date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function isPriority(value: string): boolean {
  return /^(\d+(\.\d*)?|\.\d+)$/.test(value) && Number(value) <= 1;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function resolveLoc(raw: string, base: string, line: number): string {
  const hasScheme = /^[a-z][a-z0-9+.-]*:/i.test(raw);

  if (!hasScheme && !base.trim())
    throw sitemapError(`Line ${line}: "${raw}" is relative; set the Base URL.`);

  let url: URL;

  try {
    url = hasScheme ? new URL(raw) : new URL(raw, base.trim());
  } catch {
    throw sitemapError(
      hasScheme
        ? `Line ${line}: "${raw}" is not a valid URL.`
        : `Line ${line}: "${raw}" cannot be resolved against the Base URL.`,
    );
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:')
    throw sitemapError(`Line ${line}: "${raw}" is not an http(s) URL.`);

  return hasScheme && !/[^\x21-\x7e]/.test(raw) ? raw : url.href;
}

function checkOptional(parts: string[], line: number): void {
  const [, lastmod, changefreq, priority] = parts;

  if (lastmod && !isW3cDate(lastmod))
    throw sitemapError(`Line ${line}: lastmod "${lastmod}" is not a W3C datetime.`);
  if (changefreq && !changefreqs.includes(changefreq))
    throw sitemapError(`Line ${line}: changefreq "${changefreq}" ${changefreqMessage}`);
  if (priority && !isPriority(priority))
    throw sitemapError(`Line ${line}: priority "${priority}" must be between 0.0 and 1.0.`);
}

export function generateSitemap(
  value: string,
  options: { base?: string } = {},
): { count: number; findings: Finding[]; xml: string } {
  if (value.length > maxInput) throw sitemapError('Sitemap input exceeds 5,000,000 characters.');

  const lines = value
    .split(/\r?\n/)
    .map((text, index) => ({ line: index + 1, text: text.trim() }))
    .filter(({ text }) => text && !text.startsWith('#'));

  if (lines.length === 0) throw sitemapError('Sitemap input is required.');
  if (lines.length > maxEntries) throw sitemapError('Sitemap input exceeds 50,000 URLs.');

  const findings: Finding[] = [];
  const seen = new Set<string>();
  const entries: string[] = [];

  for (const { line, text } of lines) {
    const parts = text.split(/[\s,]+/).filter(Boolean);

    if (parts.length > 4) throw sitemapError(`Line ${line}: expected at most 4 columns.`);

    const loc = resolveLoc(parts[0] ?? '', options.base ?? '', line);

    if (loc.length > maxLoc) throw sitemapError(`Line ${line}: loc exceeds 2,048 characters.`);

    checkOptional(parts, line);

    if (seen.has(loc)) {
      findings.push({ level: 'info', message: `Line ${line}: duplicate URL "${loc}" skipped.` });

      continue;
    }

    seen.add(loc);

    const tags = (['loc', 'lastmod', 'changefreq', 'priority'] as const)
      .map((tag, index) => [tag, tag === 'loc' ? loc : parts[index]] as const)
      .filter(([, content]) => content)
      .map(([tag, content]) => `    <${tag}>${escapeXml(content ?? '')}</${tag}>\n`);

    entries.push(`  <url>\n${tags.join('')}  </url>\n`);
  }

  return {
    count: entries.length,
    findings,
    xml: `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="${namespace}">\n${entries.join('')}</urlset>\n`,
  };
}

function hostOf(loc: string): string | undefined {
  if (!/^https?:\/\//i.test(loc)) return undefined;

  try {
    return new URL(loc).hostname;
  } catch {
    return undefined;
  }
}

function misplacedChildren(root: XmlElement, kind: SitemapReport['kind']): string[] {
  const expected = kind === 'urlset' ? 'url' : 'sitemap';

  return childElements(root)
    .filter((child) => !child.name.includes(':') && localName(child.name) !== expected)
    .map(({ name }) => `${kind} holds a <${name}> element; it takes only <${expected}>.`);
}

function checkEntry(
  entry: XmlElement,
  number: number,
  kind: SitemapReport['kind'],
  context: { now: Date; report: SitemapReport; seen: Set<string> },
): void {
  const { now, report, seen } = context;
  const label = `Entry ${number}`;
  const known =
    kind === 'urlset' ? ['loc', 'lastmod', 'changefreq', 'priority'] : ['loc', 'lastmod'];
  const values = new Map<string, string>();

  for (const child of childElements(entry)) {
    if (child.name.includes(':') && child.name.split(':')[0] !== entry.name.split(':')[0]) continue;

    const name = localName(child.name);

    if (known.includes(name)) values.set(name, values.get(name) ?? child.text.trim());
    else report.warnings.push(`${label}: unknown element "${name}".`);
  }

  const loc = values.get('loc');
  const host = loc ? hostOf(loc) : undefined;
  const lastmod = values.get('lastmod');
  const changefreq = values.get('changefreq');
  const priority = values.get('priority');

  if (!loc) report.errors.push(`${label}: loc is missing.`);
  else if (!host) report.errors.push(`${label}: loc "${loc}" is not an absolute http(s) URL.`);
  else if (loc.length > maxLoc) report.errors.push(`${label}: loc exceeds 2,048 characters.`);

  if (lastmod !== undefined && !isW3cDate(lastmod))
    report.errors.push(`${label}: lastmod "${lastmod}" is not a W3C datetime.`);
  if (changefreq !== undefined && !changefreqs.includes(changefreq))
    report.errors.push(`${label}: changefreq "${changefreq}" ${changefreqMessage}`);
  if (priority !== undefined && !isPriority(priority))
    report.errors.push(`${label}: priority "${priority}" must be between 0.0 and 1.0.`);

  if (lastmod !== undefined && isW3cDate(lastmod) && Date.parse(lastmod) > now.getTime())
    report.warnings.push(`${label}: lastmod is in the future.`);
  if (loc && seen.has(loc)) report.warnings.push(`${label}: duplicate loc "${loc}".`);
  if (loc) seen.add(loc);

  if (host) {
    const first = report.hosts[0];

    if (first !== undefined && host !== first)
      report.warnings.push(`${label}: host "${host}" differs from "${first}".`);
    if (!report.hosts.includes(host)) report.hosts.push(host);
  }
}

export function validateSitemap(xml: string, options: { now?: Date } = {}): SitemapReport {
  let root;

  try {
    root = parseXmlDocument(xml, { maxNodes: 1_000_000 }).root;
  } catch (error) {
    if (
      error instanceof FunctionError &&
      error.code === 'XML_LIMIT' &&
      /nodes\./.test(error.message)
    )
      throw sitemapError('Sitemap input exceeds 1,000,000 XML nodes.');

    throw error;
  }

  const name = root ? localName(root.name) : '';

  if (!root || (name !== 'urlset' && name !== 'sitemapindex'))
    throw sitemapError('Root element must be urlset or sitemapindex.');

  const kind = name;
  const entries = childElements(root).filter(
    (child) => localName(child.name) === (kind === 'urlset' ? 'url' : 'sitemap'),
  );
  const report: SitemapReport = {
    entries: entries.length,
    errors: misplacedChildren(root, kind),
    hosts: [],
    kind,
    warnings: [],
  };

  if (entries.length > maxEntries) {
    throw sitemapError('Sitemap exceeds 50,000 entries.');
  }

  const rootNamespace =
    root.attributes[root.name.includes(':') ? `xmlns:${root.name.split(':')[0]}` : 'xmlns'];

  if (rootNamespace !== namespace)
    report.warnings.push('The root element has no sitemaps.org namespace.');

  const context = { now: options.now ?? new Date(), report, seen: new Set<string>() };

  entries.forEach((entry, index) => checkEntry(entry, index + 1, kind, context));

  return report;
}

export function renderSitemapReport(report: SitemapReport): string {
  const list = (title: string, items: string[]): string =>
    `# ${title}\n${items.length > 0 ? items.map((item) => `- ${item}`).join('\n') : 'None'}`;

  return [
    `Kind: ${report.kind}\nEntries: ${report.entries}\nHosts: ${report.hosts.join(', ') || 'none'}`,
    list('Errors', report.errors),
    list('Warnings', report.warnings),
  ].join('\n\n');
}

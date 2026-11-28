import { FunctionError } from '../errors';

export type RobotsRule = { allow: boolean; line: number; pattern: string };
export type RobotsGroup = { agents: string[]; crawlDelay?: string; rules: RobotsRule[] };
export type RobotsFile = { groups: RobotsGroup[]; sitemaps: string[]; warnings: string[] };
export type RobotsTestResult = { allowed: boolean; path: string; rule?: RobotsRule };
export type RobotsTestReport = {
  file: RobotsFile;
  group?: RobotsGroup;
  results: RobotsTestResult[];
};
export type RobotsGenerateOptions = {
  agent?: string;
  allow?: string;
  crawlDelay?: string;
  disallow?: string;
  sitemaps?: string;
};

const maxInput = 500_000;
const maxPaths = 1_000;
const maxRules = 1_000;
const absoluteUrl = /^https?:\/\/\S+$/i;

function robotsError(message: string): FunctionError {
  return new FunctionError('INVALID_ROBOTS', message);
}

function warnEmptyGroups(
  file: RobotsFile,
  firstLines: Map<RobotsGroup, number>,
  openGroups: Set<RobotsGroup>,
): void {
  file.groups.forEach((candidate) => {
    if (candidate.rules.length === 0 && !openGroups.has(candidate)) {
      file.warnings.push(
        `Line ${firstLines.get(candidate)}: group "${candidate.agents.join(', ')}" has no rules.`,
      );
    }
  });
}

/**
 * What value.replace(/#.*$/, '') removes, without rescanning from every "#": "." stops at line
 * terminators, so the comment is the first "#" after the last of them.
 */
function stripComment(value: string): string {
  const from =
    Math.max(...['\n', '\r', '\u2028', '\u2029'].map((end) => value.lastIndexOf(end))) + 1;
  const hash = value.indexOf('#', from);

  return hash === -1 ? value : value.slice(0, hash);
}

export function parseRobots(text: string): RobotsFile {
  const file: RobotsFile = { groups: [], sitemaps: [], warnings: [] };
  let group: RobotsGroup | undefined;
  let collectingAgents = false;
  const firstLines = new Map<RobotsGroup, number>();
  const openGroups = new Set<RobotsGroup>();

  text
    .replace(/^\uFEFF/, '')
    .split(/\r\n|\r|\n/)
    .forEach((raw, index) => {
      const line = index + 1;
      const content = stripComment(raw).trim();
      const colon = content.indexOf(':');

      if (!content) {
        return;
      }

      if (colon < 0) {
        file.warnings.push(`Line ${line}: missing ":" separator.`);

        return;
      }

      const name = content.slice(0, colon).trim();
      const value = content.slice(colon + 1).trim();
      const field = name.toLowerCase();

      if (field === 'user-agent') {
        if (!group || !collectingAgents) {
          group = { agents: [], rules: [] };
          file.groups.push(group);
          firstLines.set(group, line);
        }

        group.agents.push(value.toLowerCase());
        collectingAgents = true;

        return;
      }

      if (field === 'sitemap') {
        if (absoluteUrl.test(value)) {
          file.sitemaps.push(value);
        } else {
          file.warnings.push(`Line ${line}: sitemap "${value}" is not an absolute http(s) URL.`);
        }
      } else if (field === 'allow' || field === 'disallow' || field === 'crawl-delay') {
        // Only rules end a run of User-agent lines; Sitemap and unknown lines do not.
        collectingAgents = false;

        if (!group) {
          file.warnings.push(`Line ${line}: rule before any User-agent group.`);
        } else if (field === 'crawl-delay') {
          group.crawlDelay = value;
        } else if (value) {
          if (!value.startsWith('/') && !value.startsWith('*')) {
            file.warnings.push(`Line ${line}: path "${value}" should start with "/".`);
          }

          group.rules.push({ allow: field === 'allow', line, pattern: value });
        } else if (field === 'disallow') {
          openGroups.add(group); // an empty Disallow is an explicit allow-all, not a missing rule
        }
      } else {
        file.warnings.push(`Line ${line}: unknown field "${name}".`);
      }
    });

  warnEmptyGroups(file, firstLines, openGroups);

  return file;
}

function safeDecode(text: string): string {
  try {
    return decodeURIComponent(text);
  } catch {
    return text;
  }
}

function decode(text: string): string {
  return text.replace(/(?:%[0-9A-Fa-f]{2})+/g, (run) =>
    run
      .split(/(%2f)/i)
      .map((part, index) => (index % 2 === 1 ? part : safeDecode(part)))
      .join(''),
  );
}

type PreparedRule = { anchored: boolean; pieces: string[]; rule: RobotsRule };

function prepare(rule: RobotsRule): PreparedRule {
  const anchored = rule.pattern.endsWith('$');

  return {
    anchored,
    pieces: decode(anchored ? rule.pattern.slice(0, -1) : rule.pattern).split('*'),
    rule,
  };
}

// Linear wildcard matcher: no regular expression, so a hostile pattern cannot backtrack.
function matches({ anchored, pieces }: PreparedRule, path: string): boolean {
  const [first = '', ...rest] = pieces;
  const last = rest.pop();

  if (last === undefined) {
    return anchored ? path === first : path.startsWith(first);
  }

  if (!path.startsWith(first)) {
    return false;
  }

  let position = first.length;

  for (const piece of rest) {
    const found = path.indexOf(piece, position);

    if (found < 0) {
      return false;
    }

    position = found + piece.length;
  }

  if (anchored) {
    return path.length - last.length >= position && path.endsWith(last);
  }

  return path.indexOf(last, position) >= 0;
}

function normalizePath(entry: string): string {
  if (/^https?:\/\//i.test(entry)) {
    try {
      const url = new URL(entry);

      return url.pathname + url.search;
    } catch {
      return entry;
    }
  }

  const path = stripComment(entry);

  return path.startsWith('/') ? path : `/${path}`;
}

function selectGroup(file: RobotsFile, agent: string): RobotsGroup | undefined {
  const token = agent.trim().toLowerCase();

  for (const key of [token, '*']) {
    const found = file.groups.filter((group) => group.agents.includes(key));

    if (found.length > 0) {
      return {
        agents: [key],
        rules: found.flatMap((group) => group.rules),
        ...(found[0]?.crawlDelay === undefined ? {} : { crawlDelay: found[0].crawlDelay }),
      };
    }
  }

  return undefined;
}

export function testRobots(
  text: string,
  options: { agent: string; paths: string },
): RobotsTestReport {
  if (!text.trim()) {
    throw robotsError('robots.txt input is required.');
  }

  if (text.length > maxInput) {
    throw robotsError('robots.txt input exceeds 500,000 characters.');
  }

  const trimmedPaths = options.paths.trimEnd();

  if ((trimmedPaths.match(/\r\n|\r|\n/g)?.length ?? 0) + 1 > maxPaths) {
    throw robotsError('Paths exceed 1,000 lines.');
  }

  const entries = trimmedPaths
    .split(/\r\n|\r|\n/)
    .map((entry) => entry.trim())
    .filter(Boolean);

  if (entries.length === 0) {
    throw robotsError('At least one path is required.');
  }

  const file = parseRobots(text);
  const group = selectGroup(file, options.agent);
  const prepared = (group?.rules ?? []).map(prepare);
  const results = entries.map((entry): RobotsTestResult => {
    const path = normalizePath(entry);

    // RFC 9309 §2.2.2: the file itself is implicitly allowed.
    if (path === '/robots.txt') return { allowed: true, path };

    const decoded = decode(path);
    let best: RobotsRule | undefined;

    for (const candidate of prepared) {
      const { rule } = candidate;
      const longer = !best || rule.pattern.length > best.pattern.length;
      const tieAllow = best && rule.pattern.length === best.pattern.length && rule.allow;

      if ((longer || tieAllow) && matches(candidate, decoded)) {
        best = rule;
      }
    }

    return { allowed: best?.allow ?? true, path, ...(best ? { rule: best } : {}) };
  });

  return { file, results, ...(group ? { group } : {}) };
}

function lines(value: string | undefined): string[] {
  return (value ?? '')
    .split(/\r\n|\r|\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

export function generateRobots(options: RobotsGenerateOptions): string {
  const agent = options.agent?.trim() || '*';
  const delay = options.crawlDelay?.trim() ?? '';
  const allow = lines(options.allow);
  const disallow = lines(options.disallow);
  const sitemaps = lines(options.sitemaps);

  if (allow.length + disallow.length > maxRules) {
    throw robotsError('Rules exceed 1,000 lines.');
  }

  if (/[\r\n]/.test(agent)) {
    throw robotsError('User agent must be a single line.');
  }

  allow.forEach((path) => {
    if (!path.startsWith('/')) {
      throw robotsError(`Allow path "${path}" must start with "/".`);
    }
  });

  disallow.forEach((path) => {
    if (!path.startsWith('/')) {
      throw robotsError(`Disallow path "${path}" must start with "/".`);
    }
  });

  sitemaps.forEach((url) => {
    if (!absoluteUrl.test(url)) {
      throw robotsError(`Sitemap "${url}" must be an absolute http(s) URL.`);
    }
  });

  if (delay && !(/^\d+(\.\d+)?$/.test(delay) && Number(delay) <= 3600)) {
    throw robotsError('Crawl delay must be a number from 0 to 3,600.');
  }

  const out = [`User-agent: ${agent}`, ...allow.map((path) => `Allow: ${path}`)];

  out.push(...disallow.map((path) => `Disallow: ${path}`));

  if (allow.length === 0 && disallow.length === 0) {
    out.push('Disallow:');
  }

  if (delay) {
    out.push(`Crawl-delay: ${delay}`);
  }

  if (sitemaps.length > 0) {
    out.push('', ...sitemaps.map((url) => `Sitemap: ${url}`));
  }

  return `${out.join('\n')}\n`;
}

export function renderRobotsTestReport(report: RobotsTestReport, agent: string): string {
  const rows = report.results.map(({ allowed, path, rule }) => {
    const label = rule
      ? `${rule.allow ? 'Allow' : 'Disallow'} line ${rule.line}`
      : 'no matching rule';

    return `${allowed ? 'allowed' : 'blocked'}  ${path}  (${label})`;
  });

  if (!report.group) {
    rows.push(`# No group matches "${agent.trim()}", so everything is allowed.`);
  }

  if (report.file.warnings.length > 0) {
    rows.push('', '# Warnings', ...report.file.warnings.map((warning) => `- ${warning}`));
  }

  return rows.join('\n');
}

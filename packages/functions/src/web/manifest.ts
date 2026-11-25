import { parsePrintedCssColor } from '../color/cssColor';
import { FunctionError } from '../errors';
import { Finding, sortFindings } from './findings';

export type ManifestOptions = {
  backgroundColor?: string;
  categories?: string;
  description?: string;
  dir?: string;
  display?: string;
  icons?: string;
  id?: string;
  lang?: string;
  name: string;
  orientation?: string;
  scope?: string;
  shortName?: string;
  startUrl?: string;
  themeColor?: string;
};

type ManifestIcon = { purpose?: string; sizes?: string; src: string; type?: string };

const maxIcons = 50;
const maxFieldChars = 2000;
const displays = ['standalone', 'fullscreen', 'minimal-ui', 'browser'];
const orientations = [
  'any',
  'natural',
  'landscape',
  'landscape-primary',
  'landscape-secondary',
  'portrait',
  'portrait-primary',
  'portrait-secondary',
];
const types: Record<string, string> = {
  ico: 'image/x-icon',
  jpeg: 'image/jpeg',
  jpg: 'image/jpeg',
  png: 'image/png',
  svg: 'image/svg+xml',
  webp: 'image/webp',
};

function manifestError(message: string): FunctionError {
  return new FunctionError('INVALID_MANIFEST', message);
}

function parseIcon(line: string): ManifestIcon {
  const [src = '', ...rest] = line.split(/\s+/);
  const type = rest.find((token) => token.includes('/'));
  const typeIndex = type ? rest.indexOf(type) : rest.length;
  // "any" is a size only before the type; after it, it is the purpose.
  const isSize = (token: string, index: number) =>
    /^\d+x\d+$/i.test(token) || (/^any$/i.test(token) && index < typeIndex);
  const sizeTokens = rest.filter(isSize);
  const sizes = sizeTokens.length > 0 ? sizeTokens.join(' ').toLowerCase() : undefined;
  const purpose = rest.filter((token, index) => !isSize(token, index) && token !== type).join(' ');
  const fileName = src.split(/[?#]/)[0] ?? '';
  const inferredSize = /(\d+x\d+)\.\w+$|-(\d+)\.\w+$/.exec(fileName);
  const inferredSizes =
    inferredSize?.[1] ?? (inferredSize?.[2] ? `${inferredSize[2]}x${inferredSize[2]}` : undefined);
  const inferredType = types[(/\.(\w+)$/.exec(fileName)?.[1] ?? '').toLowerCase()];

  return {
    src,
    ...((sizes ?? inferredSizes) ? { sizes: sizes ?? inferredSizes } : {}),
    ...((type ?? inferredType) ? { type: type ?? inferredType } : {}),
    ...(purpose ? { purpose } : {}),
  };
}

function parseIcons(text: string): ManifestIcon[] {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length > maxIcons) throw manifestError(`Icons exceed ${maxIcons} entries.`);

  return lines.map(parseIcon);
}

function checkColor(value: string, label: string): void {
  if (!value) return;

  try {
    parsePrintedCssColor(value);
  } catch {
    throw manifestError(`${label} "${value}" is not a CSS color.`);
  }
}

function checkOneOf(value: string, allowed: string[], label: string, message: string): void {
  if (value && !allowed.includes(value)) throw manifestError(`${label} must be ${message}.`);
}

function inspectIcons(icons: ManifestIcon[]): { findings: Finding[]; installable: boolean } {
  const findings: Finding[] = [];
  const has = (size: string) =>
    icons.some((icon) => icon.sizes?.split(' ').includes(size) && icon.type === 'image/png');
  const missing = ['192x192', '512x512'].filter((size) => !has(size));

  for (const icon of icons) {
    if (!icon.sizes) findings.push({ level: 'low', message: `Icon ${icon.src} has no sizes.` });
  }

  if (missing.length > 0) {
    findings.push({
      level: 'high',
      message: `Not installable: add a PNG icon for ${missing.join(' and ')}.`,
    });
  }
  if (icons.length > 0 && !icons.some((icon) => icon.purpose?.split(/\s+/).includes('maskable'))) {
    findings.push({ level: 'low', message: 'No maskable icon; Android may crop icons badly.' });
  }

  return { findings, installable: missing.length === 0 };
}

type Fields = Record<
  | 'backgroundColor'
  | 'categories'
  | 'description'
  | 'dir'
  | 'display'
  | 'id'
  | 'lang'
  | 'name'
  | 'orientation'
  | 'scope'
  | 'shortName'
  | 'startUrl'
  | 'themeColor',
  string
>;

function readFields(options: ManifestOptions): Fields {
  const clean = (value?: string) => (value ?? '').trim();
  const fields = {
    backgroundColor: clean(options.backgroundColor),
    categories: clean(options.categories),
    description: clean(options.description),
    dir: clean(options.dir),
    display: clean(options.display),
    id: clean(options.id),
    lang: clean(options.lang),
    name: clean(options.name),
    orientation: clean(options.orientation),
    scope: clean(options.scope),
    shortName: clean(options.shortName),
    startUrl: clean(options.startUrl),
    themeColor: clean(options.themeColor),
  };
  const labels: Record<string, string> = {
    dir: 'Text direction',
    id: 'ID',
    lang: 'Language',
    backgroundColor: 'Background color',
    shortName: 'Short name',
    startUrl: 'Start URL',
    themeColor: 'Theme color',
  };

  if (!fields.name) throw manifestError('Name is required.');

  for (const [key, value] of Object.entries(fields)) {
    const label = labels[key] ?? key.charAt(0).toUpperCase() + key.slice(1);

    if (value.length > maxFieldChars) {
      throw manifestError(`${label} exceeds ${maxFieldChars.toLocaleString('en-US')} characters.`);
    }
  }

  checkColor(fields.themeColor, 'Theme color');
  checkColor(fields.backgroundColor, 'Background color');
  checkOneOf(fields.display, displays, 'Display', 'standalone, fullscreen, minimal-ui or browser');
  checkOneOf(fields.orientation, orientations, 'Orientation', `one of ${orientations.join(', ')}`);
  checkOneOf(fields.dir, ['auto', 'ltr', 'rtl'], 'Text direction', 'auto, ltr or rtl');

  return fields;
}

function withinScope(startUrl: string, scope: string): boolean {
  const base = 'https://example.invalid/';

  try {
    return new URL(startUrl, base).href.startsWith(new URL(scope, base).href);
  } catch {
    return true;
  }
}

function fieldFindings(fields: Fields): Finding[] {
  const findings: Finding[] = [];

  if (fields.display === 'browser') {
    findings.push({ level: 'info', message: 'Display "browser" opens in a normal tab.' });
  }
  if (fields.lang && !/^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$/.test(fields.lang)) {
    findings.push({ level: 'medium', message: 'Language is not a valid BCP 47 tag.' });
  }
  if (fields.shortName.length > 12) {
    findings.push({
      level: 'medium',
      message: 'Short name is longer than 12 characters and may be truncated.',
    });
  }
  if (fields.scope && fields.startUrl && !withinScope(fields.startUrl, fields.scope)) {
    findings.push({ level: 'medium', message: 'Start URL is outside the scope.' });
  }

  return findings;
}

export function generateWebManifest(options: ManifestOptions): {
  findings: Finding[];
  iconCount: number;
  installable: boolean;
  json: string;
} {
  const fields = readFields(options);

  if ((options.icons ?? '').length > maxFieldChars) {
    throw manifestError(`Icons exceed ${maxFieldChars.toLocaleString('en-US')} characters.`);
  }

  const icons = parseIcons(options.icons ?? '');
  const categories = fields.categories
    .split(',')
    .map((category) => category.trim().toLowerCase())
    .filter(Boolean);
  const { findings, installable } = inspectIcons(icons);

  findings.push(...fieldFindings(fields));

  const manifest = {
    name: fields.name,
    short_name: fields.shortName,
    description: fields.description,
    id: fields.id,
    start_url: fields.startUrl,
    scope: fields.scope,
    display: fields.display,
    orientation: fields.orientation,
    theme_color: fields.themeColor,
    background_color: fields.backgroundColor,
    lang: fields.lang,
    dir: fields.dir === 'auto' ? '' : fields.dir,
    categories: categories.length > 0 ? categories : undefined,
    icons: icons.length > 0 ? icons : undefined,
  };
  const present = Object.entries(manifest).filter(
    ([, value]) => value !== '' && value !== undefined,
  );

  return {
    findings: sortFindings(findings),
    iconCount: icons.length,
    installable,
    json: JSON.stringify(Object.fromEntries(present), null, 2),
  };
}

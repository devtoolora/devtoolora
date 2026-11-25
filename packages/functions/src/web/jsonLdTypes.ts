import { FunctionError } from '../errors';
import type { Finding } from './findings';

export function invalid(message: string): FunctionError {
  return new FunctionError('INVALID_JSON_LD', message);
}

type JsonLdObject = Record<string, unknown>;
export type JsonLdFields = Record<string, string | undefined>;
export type JsonLdBuild = { findings: Finding[]; object: JsonLdObject };

const maxFieldChars = 2_000;
const maxHeadlineChars = 110;
const isoDate = /^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2}))?$/;

const labels: Record<string, string> = {
  author: 'Author',
  availability: 'Availability',
  brand: 'Brand',
  currency: 'Currency',
  datePublished: 'Date published',
  dateModified: 'Date modified',
  description: 'Description',
  email: 'Email',
  headline: 'Headline',
  images: 'Images',
  logo: 'Logo URL',
  name: 'Name',
  price: 'Price',
  publisherLogo: 'Publisher logo URL',
  publisherName: 'Publisher name',
  ratingValue: 'Rating value',
  reviewCount: 'Review count',
  sameAs: 'Profiles',
  sku: 'SKU',
  telephone: 'Telephone',
  url: 'URL',
};

export function checkLength(label: string, value: string): string {
  if (value.length > maxFieldChars) {
    throw invalid(`${label} exceeds ${maxFieldChars.toLocaleString('en-US')} characters.`);
  }

  return value;
}

export function isAbsoluteHttpUrl(value: string): boolean {
  try {
    return /^https?:$/.test(new URL(value).protocol);
  } catch {
    return false;
  }
}

function text(fields: JsonLdFields, id: string): string {
  return checkLength(labels[id] ?? id, (fields[id] ?? '').trim());
}

function required(fields: JsonLdFields, id: string): string {
  const value = text(fields, id);

  if (!value) throw invalid(`${labels[id]} is required.`);

  return value;
}

function url(fields: JsonLdFields, id: string): string | undefined {
  const value = text(fields, id);

  if (value && !isAbsoluteHttpUrl(value)) {
    throw invalid(`${labels[id]} must be an absolute http(s) URL.`);
  }

  return value || undefined;
}

function urls(fields: JsonLdFields, id: string): string[] | undefined {
  const list = checkLength(labels[id] ?? id, fields[id] ?? '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  list.forEach((line) => {
    if (!isAbsoluteHttpUrl(checkLength(labels[id] ?? id, line))) {
      throw invalid(`${labels[id]} must be an absolute http(s) URL.`);
    }
  });

  return list.length > 0 ? list : undefined;
}

function isRealDate(value: string): boolean {
  if (!isoDate.test(value) || Number.isNaN(Date.parse(value))) return false;

  const [year = 0, month = 0, day = 0] = value.slice(0, 10).split('-').map(Number);
  const check = new Date(Date.UTC(year, month - 1, day));

  return check.getUTCMonth() === month - 1 && check.getUTCDate() === day;
}

const availabilities = [
  'InStock',
  'OutOfStock',
  'PreOrder',
  'BackOrder',
  'Discontinued',
  'SoldOut',
];

function date(fields: JsonLdFields, id: string): string | undefined {
  const value = text(fields, id);

  if (value && !isRealDate(value)) {
    throw invalid(`${labels[id]} must be an ISO 8601 date or date-time.`);
  }

  return value || undefined;
}

function compact(object: JsonLdObject): JsonLdObject {
  return Object.fromEntries(Object.entries(object).filter(([, value]) => value !== undefined));
}

function recommend(object: JsonLdObject, keys: string[]): Finding[] {
  return keys
    .filter((key) => object[key] === undefined)
    .map((key) => ({ level: 'low', message: `Recommended property "${key}" is missing.` }));
}

function publisher(fields: JsonLdFields): JsonLdObject | undefined {
  const name = text(fields, 'publisherName');
  const logo = url(fields, 'publisherLogo');

  if (logo && !name) throw invalid('Publisher name is required with a publisher logo.');

  if (!name) return undefined;

  return compact({
    '@type': 'Organization',
    name,
    logo: logo && { '@type': 'ImageObject', url: logo },
  });
}

export function buildArticle(fields: JsonLdFields): JsonLdBuild {
  const headline = required(fields, 'headline');
  const author = text(fields, 'author');
  const object = compact({
    headline,
    description: text(fields, 'description') || undefined,
    image: urls(fields, 'images'),
    author: author ? { '@type': 'Person', name: author } : undefined,
    publisher: publisher(fields),
    datePublished: date(fields, 'datePublished'),
    dateModified: date(fields, 'dateModified'),
    mainEntityOfPage: url(fields, 'url'),
  });
  const findings = recommend(object, ['image', 'datePublished']);

  if (headline.length > maxHeadlineChars) {
    findings.unshift({
      level: 'low',
      message: `Headline is ${headline.length} characters; search results truncate it above ${maxHeadlineChars}.`,
    });
  }

  return { findings, object };
}

function offer(fields: JsonLdFields): JsonLdObject | undefined {
  const price = text(fields, 'price');
  const currency = text(fields, 'currency');
  const availability = text(fields, 'availability');

  if (currency && !/^[A-Za-z]{3}$/.test(currency)) {
    throw invalid('Currency must be a 3-letter ISO 4217 code.');
  }

  if (availability && !availabilities.includes(availability)) {
    throw invalid(
      'Availability must be one of InStock, OutOfStock, PreOrder, BackOrder, Discontinued or SoldOut.',
    );
  }

  if (!price && !currency && !availability) return undefined;

  return compact({
    '@type': 'Offer',
    price: price || undefined,
    priceCurrency: currency.toUpperCase() || undefined,
    availability: availability ? `https://schema.org/${availability}` : undefined,
  });
}

function rating(fields: JsonLdFields): JsonLdObject | undefined {
  const ratingValue = text(fields, 'ratingValue');
  const reviewCount = text(fields, 'reviewCount');

  if (Boolean(ratingValue) !== Boolean(reviewCount)) {
    throw invalid('Rating value and review count must be given together.');
  }

  if (ratingValue && !(/^\d+(\.\d+)?$/.test(ratingValue) && Number(ratingValue) <= 5)) {
    throw invalid('Rating value must be a number from 0 to 5.');
  }

  if (reviewCount && !/^\d+$/.test(reviewCount)) {
    throw invalid('Review count must be a whole number.');
  }

  return ratingValue ? { '@type': 'AggregateRating', ratingValue, reviewCount } : undefined;
}

export function buildProduct(fields: JsonLdFields): JsonLdBuild {
  const brand = text(fields, 'brand');
  const object = compact({
    name: required(fields, 'name'),
    description: text(fields, 'description') || undefined,
    image: urls(fields, 'images'),
    sku: text(fields, 'sku') || undefined,
    brand: brand ? { '@type': 'Brand', name: brand } : undefined,
    offers: offer(fields),
    aggregateRating: rating(fields),
    url: url(fields, 'url'),
  });

  return { findings: recommend(object, ['image', 'offers']), object };
}

export function buildOrganization(fields: JsonLdFields): JsonLdBuild {
  const object = compact({
    name: required(fields, 'name'),
    description: text(fields, 'description') || undefined,
    image: urls(fields, 'images'),
    url: url(fields, 'url'),
    logo: url(fields, 'logo'),
    sameAs: urls(fields, 'sameAs'),
    telephone: text(fields, 'telephone') || undefined,
    email: text(fields, 'email') || undefined,
  });

  return { findings: recommend(object, ['logo', 'url']), object };
}

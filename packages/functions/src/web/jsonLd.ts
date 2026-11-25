import { sortFindings, type Finding } from './findings';
import {
  buildArticle,
  buildOrganization,
  buildProduct,
  checkLength,
  isAbsoluteHttpUrl,
  invalid,
  type JsonLdBuild,
  type JsonLdFields,
} from './jsonLdTypes';

export type JsonLdType = 'Article' | 'BreadcrumbList' | 'FAQPage' | 'Organization' | 'Product';

const maxFaqEntries = 500;
const maxBreadcrumbs = 100;

function nonBlankLines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function buildFaq(text: string): JsonLdBuild {
  const entries = text
    .trim()
    .split(/\r?\n\s*\r?\n/)
    .filter((entry) => entry.trim());

  if (entries.length === 0) throw invalid('At least one question is required.');

  if (entries.length > maxFaqEntries) {
    throw invalid(`FAQ entries exceed ${maxFaqEntries}.`);
  }

  const mainEntity = entries.map((entry, index) => {
    const [question = '', ...answer] = nonBlankLines(entry);

    if (answer.length === 0) throw invalid(`Entry ${index + 1} needs an answer line.`);

    return {
      '@type': 'Question',
      name: checkLength('Question', question),
      acceptedAnswer: { '@type': 'Answer', text: checkLength('Answer', answer.join('\n')) },
    };
  });

  return { findings: [], object: { mainEntity } };
}

function buildBreadcrumbs(text: string): JsonLdBuild {
  const lines = text
    .split(/\r?\n/)
    .map((line, index) => ({ line: line.trim(), number: index + 1 }))
    .filter(({ line }) => line);

  if (lines.length === 0) throw invalid('At least one breadcrumb is required.');

  if (lines.length > maxBreadcrumbs) {
    throw invalid(`Breadcrumbs exceed ${maxBreadcrumbs}.`);
  }

  const itemListElement = lines.map(({ line, number }, index) => {
    const split = line.lastIndexOf('|');
    const name = split < 0 ? line : line.slice(0, split);
    const item = split < 0 ? '' : line.slice(split + 1).trim();

    if (!name.trim()) throw invalid(`Line ${number}: name is required.`);

    if (!item && index < lines.length - 1) {
      throw invalid(`Line ${number}: only the last breadcrumb may omit its URL.`);
    }

    if (item && !isAbsoluteHttpUrl(item)) {
      throw invalid(`Line ${number}: "${item}" is not an absolute http(s) URL.`);
    }

    return {
      '@type': 'ListItem',
      position: index + 1,
      name: checkLength('Name', name.trim()),
      ...(item ? { item: checkLength('URL', item) } : {}),
    };
  });

  return { findings: [], object: { itemListElement } };
}

function build(type: string, fields: JsonLdFields, text: string): JsonLdBuild {
  switch (type) {
    case 'Article':
      return buildArticle(fields);
    case 'Product':
      return buildProduct(fields);
    case 'Organization':
      return buildOrganization(fields);
    case 'FAQPage':
      return buildFaq(text);
    case 'BreadcrumbList':
      return buildBreadcrumbs(text);
    default:
      throw invalid('Type must be Article, Product, Organization, FAQPage or BreadcrumbList.');
  }
}

export function generateJsonLd(
  type: string,
  fields: JsonLdFields,
  text: string,
): { findings: Finding[]; json: string; propertyCount: number } {
  const { findings, object } = build(type, fields, text);

  return {
    findings: sortFindings(findings),
    json: JSON.stringify({ '@context': 'https://schema.org', '@type': type, ...object }, null, 2),
    propertyCount: Object.keys(object).length,
  };
}

export function wrapJsonLdScript(json: string): string {
  return `<script type="application/ld+json">\n${json.replace(/</g, '\\u003c')}\n</script>`;
}

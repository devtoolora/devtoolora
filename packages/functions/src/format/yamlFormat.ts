import { isCollection, parseAllDocuments, visit } from 'yaml';
import type { Document, Tags } from 'yaml';
import { FunctionError } from '../errors';
import { requiredText } from './shared';
import { escapeUnsafeStrings } from './yaml';

export interface YamlFormatOptions {
  indent: 2 | 4;
  mode: 'format' | 'validate';
}

export interface YamlFormatResult {
  documents: number;
  text: string;
}

const maxAliases = 10_000;
const maxDepth = 100;
const maxDocuments = 100;
const maxLength = 5_000_000;
const numberTag = /:(?:float|int)$/;

// The library prints numbers from their JS value, which rounds big ones and rewrites 0644 or 1e400.
function keepNumberSpelling(tags: Tags): Tags {
  return tags.map((tag): Tags[number] => {
    if (typeof tag === 'string' || tag.collection || !numberTag.test(tag.tag)) return tag;

    const { stringify } = tag;

    return {
      ...tag,
      stringify: (node, ...context) => node.source ?? stringify?.(node, ...context) ?? '',
    };
  });
}

export function formatYaml(input: string, options: YamlFormatOptions): YamlFormatResult {
  if (input.length > maxLength) {
    throw new FunctionError('YAML_TOO_LARGE', 'YAML input is limited to 5,000,000 characters.');
  }

  requiredText(input, 'YAML');

  const source = input.replace(/\r\n?/g, '\n');
  const documents = parseAllDocuments(source, {
    customTags: (tags) => escapeUnsafeStrings(keepNumberSpelling(tags)),
    logLevel: 'silent',
    uniqueKeys: true,
  });

  if (documents.length > maxDocuments) {
    throw new FunctionError('YAML_TOO_MANY_DOCUMENTS', 'YAML input is limited to 100 documents.');
  }

  documents.forEach(checkDocument);

  if (options.mode === 'format' && documents.length === 0)
    return { documents: 0, text: `${source.trim()}\n` };

  const text =
    options.mode === 'validate'
      ? input
      : documents.map((document, index) => printDocument(document, index, options.indent)).join('');

  return { documents: documents.length, text };
}

function printDocument(document: Document.Parsed, index: number, indent: 2 | 4): string {
  // toString writes `---` itself when docStart is set; joining with it would double it.
  if (index > 0) document.directives.docStart = true;

  const printed = document.toString({ indent, lineWidth: 0 });

  // An empty document prints a blank line that each later format would grow, also after
  // directives or before `...`.
  if (/^(?:---\n)?\n+$/.test(printed)) return '---\n';

  // The library also indents the comment of an empty document by one space.
  return printed
    .replace(/(^|\n)---\n\n+(?=(?:\.\.\.\n)?$)/, '$1---\n')
    .replace(/(^|\n)---\n +(?=#)/, '$1---\n');
}

function checkDocument(document: Document.Parsed): void {
  const [error] = document.errors;

  if (error) {
    const position = error.linePos?.[0];
    const where = position ? ` (line ${position.line}, column ${position.col})` : '';
    const message =
      error.code === 'DUPLICATE_KEY'
        ? 'Duplicate key, map keys must be unique'
        : (error.message.split(' at line ')[0] ?? 'Invalid YAML').replace(/\.$/, '');

    throw new FunctionError('INVALID_YAML', `${message}${where}.`);
  }

  let deepest = 0;

  visit(document, {
    Collection(_key, node, path) {
      if (isCollection(node)) deepest = Math.max(deepest, path.filter(isCollection).length + 1);
    },
  });

  if (deepest > maxDepth) {
    throw new FunctionError('YAML_TOO_DEEP', 'YAML nesting is limited to 100 nesting levels.');
  }

  try {
    document.toJS({ maxAliasCount: maxAliases });
  } catch {
    throw new FunctionError(
      'YAML_TOO_MANY_ALIASES',
      'YAML alias expansion is limited to 10,000 alias expansions.',
    );
  }
}

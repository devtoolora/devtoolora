import { FunctionError } from '../errors';
import { aiLimits } from './limits';

export type TemplateNode =
  | { kind: 'text'; text: string }
  | { escape: boolean; kind: 'variable'; line: number; name: string; source: string }
  | { children: TemplateNode[]; inverted: boolean; kind: 'section'; name: string };

type ParsedTemplate = { names: Set<string>; nodes: TemplateNode[]; sections: number };

type TagKind = 'close' | 'comment' | 'inverted' | 'raw' | 'section' | 'variable';
type Tag = { end: number; kind: TagKind; line: number; name: string; start: number };
type OpenSection = { line: number; node: Extract<TemplateNode, { kind: 'section' }> };

const { sectionDepth } = aiLimits.template;
const sigils: Record<string, TagKind> = {
  '!': 'comment',
  '#': 'section',
  '&': 'raw',
  '/': 'close',
  '^': 'inverted',
};
const LF = 10;
const CR = 13;

export const failTemplate = (message: string): never => {
  throw new FunctionError('INVALID_AI_INPUT', message);
};

function classify(inner: string, triple: boolean, line: number): Omit<Tag, 'end' | 'start'> {
  if (triple) return { kind: 'raw', line, name: inner.trim() };

  const body = inner.trimStart();
  const sigil = body.charAt(0);

  if (sigil === '>') failTemplate(`Partials ({{> name}}) are not supported (line ${line}).`);
  if (sigil === '=') failTemplate(`Delimiter changes ({{= =}}) are not supported (line ${line}).`);

  const kind = Object.hasOwn(sigils, sigil) ? sigils[sigil] : undefined;

  if (kind === undefined) return { kind: 'variable', line, name: body.trim() };

  return { kind, line, name: kind === 'comment' ? '' : body.slice(1).trim() };
}

function scanTags(template: string): Tag[] {
  const tags: Tag[] = [];
  let line = 1;
  let counted = 0;
  let open = template.indexOf('{{');

  while (open !== -1) {
    for (; counted < open; counted += 1) if (template.charCodeAt(counted) === LF) line += 1;

    const triple = template.charAt(open + 2) === '{';
    const closer = triple ? '}}}' : '}}';
    const inner = open + closer.length;
    const close = template.indexOf(closer, inner);

    if (close === -1) failTemplate(`Tag opened on line ${line} is not closed.`);

    const end = close + closer.length;

    const tag = classify(template.slice(inner, close), triple, line);

    if (tag.name === '' && tag.kind !== 'comment') failTemplate(`Empty tag on line ${line}.`);

    tags.push({ ...tag, end, start: open });
    open = template.indexOf('{{', end);
  }

  return tags;
}

const isBlank = (code: number) => code === 32 || code === 9;

/** The Mustache standalone rule: a lone block tag takes its whole line with it. */
function standaloneRange(template: string, tag: Tag, floor: number): [number, number] {
  if (tag.kind === 'raw' || tag.kind === 'variable') return [tag.start, tag.end];

  let from = tag.start;
  let to = tag.end;

  while (from > floor && isBlank(template.charCodeAt(from - 1))) from -= 1;
  while (to < template.length && isBlank(template.charCodeAt(to))) to += 1;

  if (template.charCodeAt(to) === CR && template.charCodeAt(to + 1) === LF) to += 1;

  const lineStart = from === 0 || template.charCodeAt(from - 1) === LF;
  const lineEnd = to === template.length || template.charCodeAt(to) === LF;

  return lineStart && lineEnd ? [from, Math.min(to + 1, template.length)] : [tag.start, tag.end];
}

function closeSection(stack: OpenSection[], tag: Tag): void {
  const open = stack.pop();

  if (open === undefined)
    failTemplate(`Closing tag "${tag.name}" on line ${tag.line} has no open section.`);
  else if (open.node.name !== tag.name)
    failTemplate(
      `Section "${open.node.name}" opened on line ${open.line} is closed by "${tag.name}" on line ${tag.line}.`,
    );
}

export function parseTemplate(template: string): ParsedTemplate {
  const root: TemplateNode[] = [];
  const stack: OpenSection[] = [];
  const names = new Set<string>();
  const children = () => stack.at(-1)?.node.children ?? root;
  let sections = 0;
  let cursor = 0;

  for (const tag of scanTags(template)) {
    const [start, end] = standaloneRange(template, tag, cursor);

    if (start > cursor) children().push({ kind: 'text', text: template.slice(cursor, start) });

    cursor = end;

    if (tag.kind === 'close') closeSection(stack, tag);
    else if (tag.kind === 'section' || tag.kind === 'inverted') {
      if (stack.length === sectionDepth)
        failTemplate(
          `Sections must be nested at most ${sectionDepth} levels deep (line ${tag.line}).`,
        );

      const section: OpenSection = {
        line: tag.line,
        node: { children: [], inverted: tag.kind === 'inverted', kind: 'section', name: tag.name },
      };

      children().push(section.node);
      stack.push(section);
      sections += 1;
    } else if (tag.kind !== 'comment') {
      names.add(tag.name);

      children().push({
        escape: tag.kind === 'variable',
        kind: 'variable',
        line: tag.line,
        name: tag.name,
        source: template.slice(tag.start, tag.end),
      });
    }
  }

  if (cursor < template.length) root.push({ kind: 'text', text: template.slice(cursor) });

  const unclosed = stack.at(-1);

  if (unclosed)
    failTemplate(`Section "${unclosed.node.name}" opened on line ${unclosed.line} is not closed.`);

  return { names, nodes: root, sections };
}

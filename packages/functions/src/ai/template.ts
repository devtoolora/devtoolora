import { stringifyExactJson, type ExactJsonValue } from '../format/json';
import { JsonNumberToken } from '../format/jsonDocument';
import { aiLimits } from './limits';
import { failTemplate, parseTemplate, type TemplateNode } from './templateParse';

export type TemplateOptions = { escape: 'html' | 'none'; missing: 'empty' | 'error' | 'keep' };

export type TemplateResult = {
  iterations: number;
  kept: string[];
  output: string;
  sections: number;
  variables: number;
};

type Frame = { index: number; item: number; items: ExactJsonValue[] | null; nodes: TemplateNode[] };
type Variable = Extract<TemplateNode, { kind: 'variable' }>;
type Section = Extract<TemplateNode, { kind: 'section' }>;

type RenderState = {
  frames: Frame[];
  iterations: number;
  kept: Set<string>;
  length: number;
  options: TemplateOptions;
  parts: string[];
};

const {
  iterations: maxIterations,
  outputChars,
  steps: maxSteps,
  templateChars,
} = aiLimits.template;
const format = new Intl.NumberFormat('en-US');
const htmlEntities: Record<string, string> = {
  '"': '&quot;',
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
};

const escapeHtml = (text: string) => text.replace(/[&"<>]/g, (char) => htmlEntities[char] ?? char);

function child(value: ExactJsonValue | undefined, key: string): ExactJsonValue | undefined {
  if (
    value === null ||
    typeof value !== 'object' ||
    value instanceof JsonNumberToken ||
    !Object.hasOwn(value, key)
  )
    return undefined;

  return Array.isArray(value) ? value[Number(key)] : value[key];
}

/** Mustache lookup: the first part walks the context stack, the rest resolves from it. */
function lookup(frames: Frame[], name: string): ExactJsonValue | undefined {
  const [first = '', ...rest] = name.split('.');

  for (let i = frames.length - 1; i >= 0; i -= 1) {
    const items = frames[i]?.items;

    if (!items) continue;

    const context = items[frames[i]?.item ?? 0] ?? null;

    if (name === '.') return context;

    const found = child(context, first);

    if (found !== undefined) return rest.reduce<ExactJsonValue | undefined>(child, found);
  }

  return undefined;
}

function print(value: ExactJsonValue): string {
  if (value === null) return '';

  return typeof value === 'string' ? value : stringifyExactJson(value);
}

function append(state: RenderState, text: string): void {
  if (state.length + text.length > outputChars)
    failTemplate(`Output must be at most ${format.format(outputChars)} characters.`);

  state.length += text.length;
  state.parts.push(text);
}

function iterate(state: RenderState): void {
  if (state.iterations === maxIterations)
    failTemplate(`Rendering must take at most ${format.format(maxIterations)} section iterations.`);

  state.iterations += 1;
}

function renderVariable(state: RenderState, node: Variable): void {
  const value = lookup(state.frames, node.name);
  const { escape, missing } = state.options;

  if (value !== undefined) {
    const text = print(value);

    append(state, node.escape && escape === 'html' ? escapeHtml(text) : text);
  } else if (missing === 'error') {
    failTemplate(`Variable "${node.name}" is missing (line ${node.line}).`);
  } else if (missing === 'keep') {
    state.kept.add(node.name);
    append(state, node.source);
  }
}

function enterSection(state: RenderState, node: Section): void {
  const value = lookup(state.frames, node.name) ?? null;
  const truthy = Array.isArray(value) ? value.length > 0 : Boolean(value);

  if (truthy === node.inverted) return;

  const items = Array.isArray(value) ? value : [value];

  iterate(state);

  state.frames.push({
    index: 0,
    item: 0,
    items: node.inverted ? null : items,
    nodes: node.children,
  });
}

export function renderTemplate(
  template: string,
  variables: ExactJsonValue,
  options: TemplateOptions,
): TemplateResult {
  if (template.length > templateChars)
    failTemplate(`Template must be at most ${format.format(templateChars)} characters.`);

  const { names, nodes, sections } = parseTemplate(template);
  const state: RenderState = {
    frames: [{ index: 0, item: 0, items: [variables], nodes }],
    iterations: 0,
    kept: new Set(),
    length: 0,
    options,
    parts: [],
  };
  let steps = 0;

  for (let frame = state.frames.at(-1); frame; frame = state.frames.at(-1)) {
    const node = frame.nodes[frame.index];

    if (node === undefined) {
      if (frame.items && frame.item + 1 < frame.items.length) {
        iterate(state);
        frame.item += 1;
        frame.index = 0;
      } else state.frames.pop();
    } else {
      // Nodes that print nothing still cost work, so every evaluation is charged.
      if (steps === maxSteps)
        failTemplate(`Rendering must take at most ${format.format(maxSteps)} steps.`);

      steps += 1;
      frame.index += 1;

      if (node.kind === 'text') append(state, node.text);
      else if (node.kind === 'variable') renderVariable(state, node);
      else enterSection(state, node);
    }
  }

  return {
    iterations: state.iterations,
    kept: [...state.kept],
    output: state.parts.join(''),
    sections,
    variables: names.size,
  };
}

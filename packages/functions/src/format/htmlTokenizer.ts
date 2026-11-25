export type HtmlToken = {
  kind: 'comment' | 'doctype' | 'end' | 'raw' | 'start' | 'text';
  name?: string;
  selfClosing?: boolean;
  text: string;
};

const rawTextElements: ReadonlySet<string> = new Set(['pre', 'script', 'style', 'textarea']);

export function tokenizeHtml(input: string): HtmlToken[] {
  const tokens: HtmlToken[] = [];
  let index = 0;

  while (index < input.length) {
    const token = input[index] === '<' ? readMarkup(input, index) : undefined;

    if (!token) {
      const next = input.indexOf('<', index + 1);
      const end = next === -1 ? input.length : next;

      pushText(tokens, input.slice(index, end));
      index = end;

      continue;
    }
    if (token === 'rest') {
      pushText(tokens, input.slice(index));

      break;
    }

    tokens.push(token);
    index += token.text.length;

    if (token.kind === 'start' && !token.selfClosing && rawTextElements.has(token.name ?? '')) {
      const end = findRawEnd(input, index, token.name ?? '');

      if (end > index) tokens.push({ kind: 'raw', text: input.slice(index, end) });

      index = end;
    }
  }

  return tokens;
}

function pushText(tokens: HtmlToken[], text: string) {
  const last = tokens[tokens.length - 1];

  if (last?.kind === 'text') last.text += text;
  else tokens.push({ kind: 'text', text });
}

function readMarkup(input: string, start: number): HtmlToken | 'rest' | undefined {
  const next = input[start + 1] ?? '';

  if (input.startsWith('<!--', start)) {
    const end = input.indexOf('-->', start + 4);

    return end === -1 ? 'rest' : { kind: 'comment', text: input.slice(start, end + 3) };
  }
  if (next === '!' || next === '?') {
    const end = input.indexOf('>', start);

    return end === -1 ? 'rest' : { kind: 'doctype', text: input.slice(start, end + 1) };
  }

  const isEnd = next === '/';
  const nameStart = isEnd ? start + 2 : start + 1;

  if (!/[A-Za-z]/.test(input[nameStart] ?? '')) return undefined;

  const end = findTagEnd(input, nameStart);

  if (end === -1) return 'rest';

  const text = input.slice(start, end + 1);
  const name = /^[^\s/>]+/.exec(input.slice(nameStart, end))?.[0].toLowerCase() ?? '';

  return isEnd
    ? { kind: 'end', name, text }
    : { kind: 'start', name, selfClosing: text.endsWith('/>'), text };
}

function findTagEnd(input: string, from: number): number {
  let quote = '';

  for (let index = from; index < input.length; index++) {
    const char = input[index];

    if (quote) {
      if (char === quote) quote = '';
    } else if (char === '"' || char === "'") quote = char;
    else if (char === '>') return index;
  }

  return -1;
}

function findRawEnd(input: string, from: number, name: string): number {
  for (
    let index = input.indexOf('</', from);
    index !== -1;
    index = input.indexOf('</', index + 2)
  ) {
    if (
      input.slice(index + 2, index + 2 + name.length).toLowerCase() === name &&
      !/[\w-]/.test(input[index + 2 + name.length] ?? '')
    )
      return index;
  }

  return input.length;
}

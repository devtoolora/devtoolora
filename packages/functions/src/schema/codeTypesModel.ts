export type CodeType =
  | { kind: 'string' | 'integer' | 'number' | 'boolean' | 'any' }
  | { item: CodeType; kind: 'array' }
  | { kind: 'record'; name: string };
export type CodeField = { jsonKey: string; nullable: boolean; optional: boolean; type: CodeType };
export type CodeRecord = { fields: CodeField[]; name: string };
export type NameStyle = 'camel' | 'pascal' | 'snake';

export type TypeNames = {
  any: string;
  array: (item: string) => string;
  boolean: string;
  integer: string;
  number: string;
  string: string;
};

export function renderType(type: CodeType, names: TypeNames): string {
  if (type.kind === 'record') return type.name;
  if (type.kind === 'array') return names.array(renderType(type.item, names));

  return names[type.kind];
}

export function usesType(records: CodeRecord[], test: (type: CodeType) => boolean): boolean {
  const visit = (type: CodeType): boolean =>
    test(type) || (type.kind === 'array' && visit(type.item));

  return records.some((record) => record.fields.some((field) => visit(field.type)));
}

export function stringLiteral(value: string): string {
  return JSON.stringify(value);
}

const braceEscapes = new Map([
  ['"', '\\"'],
  ['\\', '\\\\'],
  ['\n', '\\n'],
  ['\r', '\\r'],
  ['\t', '\\t'],
]);

export function braceStringLiteral(value: string): string {
  const escaped = value.replace(
    /["\\]|\p{Cc}/gu,
    (char) =>
      braceEscapes.get(char) ??
      `\\u{${(char.codePointAt(0) ?? 0).toString(16).toUpperCase().padStart(4, '0')}}`,
  );

  return `"${escaped}"`;
}

export function fieldNames(
  record: CodeRecord,
  style: NameStyle,
  keywords: ReadonlySet<string>,
  reserved?: string,
): string[] {
  const used = new Set<string>();

  return record.fields.map((field) => {
    const named = identifier(field.jsonKey, style, keywords);
    const base = named === reserved ? `${named}Value` : named;
    let name = base;

    for (let suffix = 2; used.has(name); suffix += 1) name = `${base}${suffix}`;
    used.add(name);

    return name;
  });
}

function identifier(key: string, style: NameStyle, keywords: ReadonlySet<string>): string {
  const found = key
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .match(/\d+[a-z]*|[A-Z]?[a-z]+|[A-Z]+(?![a-z])/g);
  const words = found && !/^\d/.test(found[0] ?? '') ? found : ['field', ...(found ?? [])];
  const capital = (word: string) => `${word.charAt(0).toUpperCase()}${word.slice(1).toLowerCase()}`;
  let name: string;

  if (style === 'snake') name = words.map((word) => word.toLowerCase()).join('_');
  else if (style === 'pascal') name = words.map(capital).join('');
  else
    name = words.map((word, index) => (index === 0 ? word.toLowerCase() : capital(word))).join('');

  return keywords.has(name) ? `${name}_` : name;
}

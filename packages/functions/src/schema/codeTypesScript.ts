import {
  braceStringLiteral,
  fieldNames,
  renderType,
  stringLiteral,
  usesType,
} from './codeTypesModel';
import type { CodeField, CodeRecord, TypeNames } from './codeTypesModel';

const pythonKeywords = new Set(
  'False None True and as assert async await break class continue def del elif else except finally for from global if import in is lambda nonlocal not or pass raise return try while with yield'.split(
    ' ',
  ),
);
// A field named like a builtin would shadow it for the annotations after it in the class body.
const pythonReservedNames = new Set([...pythonKeywords, 'bool', 'float', 'int', 'list', 'str']);
const swiftKeywords = new Set(
  'class enum struct let var import protocol extension return self Self in is as if else for while switch case default func init deinit subscript typealias associatedtype operator internal private public fileprivate open static where guard defer do repeat break continue fallthrough throw throws rethrows try catch true false nil super Any inout'.split(
    ' ',
  ),
);

const pythonNames: TypeNames = {
  any: 'Any',
  array: (item) => `list[${item}]`,
  boolean: 'bool',
  integer: 'int',
  number: 'float',
  string: 'str',
};
const swiftNames: TypeNames = {
  any: 'AnyCodable',
  array: (item) => `[${item}]`,
  boolean: 'Bool',
  integer: 'Int',
  number: 'Double',
  string: 'String',
};

export function renderPython(records: CodeRecord[], flavor: 'dataclass' | 'pydantic'): string {
  const pydantic = flavor === 'pydantic';
  const aliased = records.some((record) =>
    fieldNames(record, 'snake', pythonReservedNames).some(
      (name, i) => name !== record.fields[i]?.jsonKey,
    ),
  );
  const imports = [
    pydantic
      ? `from pydantic import BaseModel${aliased ? ', Field' : ''}`
      : 'from dataclasses import dataclass',
    ...(usesType(records, (type) => type.kind === 'any') ? ['from typing import Any'] : []),
  ];
  const blocks = [...records].reverse().map((record) => {
    const names = fieldNames(record, 'snake', pythonReservedNames);
    const entries = record.fields.map((field, index) => ({ field, name: names[index] ?? '' }));
    // A dataclass cannot put a field without a default after one that has it.
    const ordered = [
      ...entries.filter((entry) => !entry.field.optional),
      ...entries.filter((entry) => entry.field.optional),
    ];
    const lines = ordered.flatMap(({ field, name }) => pythonField(field, name, pydantic));

    return [
      ...(pydantic
        ? [`class ${record.name}(BaseModel):`]
        : ['@dataclass', `class ${record.name}:`]),
      ...lines,
    ].join('\n');
  });

  return `${imports.join('\n')}\n\n\n${blocks.join('\n\n\n')}`;
}

function pythonField(field: CodeField, name: string, pydantic: boolean): string[] {
  const base = renderType(field.type, pythonNames);
  const type =
    (field.nullable || field.optional) && field.type.kind !== 'any' ? `${base} | None` : base;
  const renamed = name !== field.jsonKey;
  const alias = `alias=${stringLiteral(field.jsonKey)}`;

  if (pydantic && renamed)
    return [`    ${name}: ${type} = Field(${field.optional ? 'default=None, ' : ''}${alias})`];

  const comment = renamed ? [`    # json key: ${stringLiteral(field.jsonKey)}`] : [];

  return [...comment, `    ${name}: ${type}${field.optional ? ' = None' : ''}`];
}

export function renderSwift(records: CodeRecord[]): string {
  const blocks = records.map((record) => {
    const names = fieldNames(record, 'camel', swiftKeywords);
    const lines = record.fields.map((field, index) => {
      const optional = field.nullable || field.optional;

      return `    let ${names[index]}: ${renderType(field.type, swiftNames)}${optional ? '?' : ''}`;
    });
    const renamed = names.some((name, index) => name !== record.fields[index]?.jsonKey);
    const keys = record.fields.map((field, index) =>
      names[index] === field.jsonKey
        ? `        case ${names[index]}`
        : `        case ${names[index]} = ${braceStringLiteral(field.jsonKey)}`,
    );

    return [
      `struct ${record.name}: Codable {`,
      ...lines,
      ...(renamed ? ['', '    enum CodingKeys: String, CodingKey {', ...keys, '    }'] : []),
      '}',
    ].join('\n');
  });
  const note = usesType(records, (type) => type.kind === 'any')
    ? [
        '// AnyCodable: define or import a type-erased Codable wrapper for the untyped values below.',
      ]
    : [];

  return [...note, ...blocks].join('\n\n');
}

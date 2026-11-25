import {
  braceStringLiteral,
  fieldNames,
  renderType,
  stringLiteral,
  usesType,
} from './codeTypesModel';
import type { CodeField, CodeRecord, CodeType, TypeNames } from './codeTypesModel';

const rustKeywords = new Set(
  'as break const continue crate else enum extern false fn for if impl in let loop match mod move mut pub ref return self static struct super trait true type unsafe use where while async await dyn box do final try abstract become macro override priv typeof unsized virtual yield'.split(
    ' ',
  ),
);
const jvmKeywords = new Set(
  'abstract class do else enum false final for if import in interface is new null object package private protected public return static super this throw true try val var void when while default int long short byte boolean double float char switch case catch fun typealias typeof as break continue instanceof synchronized transient volatile goto const assert extends implements native strictfp throws record sealed permits clone hashCode toString getClass wait notify notifyAll finalize'.split(
    ' ',
  ),
);
const csharpKeywords = new Set(
  'class object string int long bool double event namespace new null out params private public ref return static this using void default base switch case catch char short byte float decimal uint ulong ushort sbyte enum struct interface abstract virtual override sealed readonly const is as in if else for foreach while do try finally throw typeof sizeof lock operator delegate checked unchecked unsafe fixed goto break continue internal protected explicit implicit extern stackalloc'.split(
    ' ',
  ),
);

const goNames: TypeNames = {
  any: 'any',
  array: (item) => `[]${item}`,
  boolean: 'bool',
  integer: 'int64',
  number: 'float64',
  string: 'string',
};
const rustNames: TypeNames = {
  any: 'serde_json::Value',
  array: (item) => `Vec<${item}>`,
  boolean: 'bool',
  integer: 'i64',
  number: 'f64',
  string: 'String',
};
const kotlinNames: TypeNames = {
  any: 'Any',
  array: (item) => `List<${item}>`,
  boolean: 'Boolean',
  integer: 'Long',
  number: 'Double',
  string: 'String',
};
const csharpNames: TypeNames = {
  any: 'object',
  array: (item) => `List<${item}>`,
  boolean: 'bool',
  integer: 'long',
  number: 'double',
  string: 'string',
};
const javaBoxed: TypeNames = { ...kotlinNames, any: 'Object' };
const javaPrimitive: TypeNames = {
  ...javaBoxed,
  boolean: 'boolean',
  integer: 'long',
  number: 'double',
};

export function renderGo(records: CodeRecord[]): string {
  return records
    .map((record) => {
      const names = fieldNames(record, 'pascal', new Set());
      const lines = record.fields.flatMap((field, index) => {
        const base = renderType(field.type, goNames);
        const pointer = field.optional && isScalarOrRecord(field.type);
        const declaration = `\t${names[index]} ${pointer ? '*' : ''}${base}`;

        // encoding/json splits tag options on commas, so such a key has no tag spelling.
        if (field.jsonKey.includes(','))
          return [
            `\t// key ${stringLiteral(field.jsonKey)} contains a comma; encoding/json cannot map it`,
            `${declaration} \`json:"-"\``,
          ];

        const key = stringLiteral(field.jsonKey).slice(1, -1).replaceAll('`', '\\u0060');
        // A bare "-" tag skips the field; "-," maps the key "-".
        const bareDash = key === '-' && !field.optional;
        const options = `${field.optional ? ',omitempty' : ''}${bareDash ? ',' : ''}`;

        return [`${declaration} \`json:"${key}${options}"\``];
      });

      return [`type ${record.name} struct {`, ...lines, '}'].join('\n');
    })
    .join('\n\n');
}

export function renderRust(records: CodeRecord[]): string {
  const blocks = records.map((record) => {
    const names = fieldNames(record, 'snake', rustKeywords);
    const lines = ['#[derive(Debug, Serialize, Deserialize)]', `pub struct ${record.name} {`];

    record.fields.forEach((field, index) => {
      const base = renderType(field.type, rustNames);
      const type = isOptionalType(field) ? `Option<${base}>` : base;

      if (names[index] !== field.jsonKey)
        lines.push(`    #[serde(rename = ${braceStringLiteral(field.jsonKey)})]`);

      lines.push(`    pub ${names[index]}: ${type},`);
    });

    return [...lines, '}'].join('\n');
  });

  return ['use serde::{Deserialize, Serialize};', ...blocks].join('\n\n');
}

export function renderKotlin(records: CodeRecord[]): string {
  const renamed = records.some((record) =>
    fieldNames(record, 'camel', jvmKeywords).some((name, i) => name !== record.fields[i]?.jsonKey),
  );
  const imports = [
    ...(renamed ? ['import kotlinx.serialization.SerialName'] : []),
    'import kotlinx.serialization.Serializable',
  ];
  const blocks = records.map((record) => {
    const names = fieldNames(record, 'camel', jvmKeywords);
    const lines = record.fields.map((field, index) => {
      const base = renderType(field.type, kotlinNames);
      const nullable = field.nullable || field.optional;
      const type = `${base}${nullable ? '?' : ''}${field.optional ? ' = null' : ''}`;
      const serialName =
        names[index] === field.jsonKey
          ? ''
          : `@SerialName(${stringLiteral(field.jsonKey).replaceAll('$', '\\$')}) `;

      return `    ${serialName}val ${names[index]}: ${type},`;
    });

    return ['@Serializable', `data class ${record.name}(`, ...lines, ')'].join('\n');
  });

  return [imports.join('\n'), ...blocks].join('\n\n');
}

export function renderJava(records: CodeRecord[]): string {
  const usesList = usesType(records, (type) => type.kind === 'array');
  const blocks = records.map((record) => {
    const names = fieldNames(record, 'camel', jvmKeywords);
    // Boxed components let a missing or null value deserialize as null instead of a default.
    const boxed = record.fields.some((field) => field.optional && field.type.kind !== 'any');
    const components = record.fields.map((field, index) => {
      // A primitive cannot be a generic argument, so List items are always boxed.
      const type = renderType(
        field.type,
        boxed || field.type.kind === 'array' ? javaBoxed : javaPrimitive,
      );
      const annotation =
        names[index] === field.jsonKey ? '' : `@JsonProperty(${stringLiteral(field.jsonKey)}) `;

      return `${annotation}${type} ${names[index]}`;
    });

    return `public record ${record.name}(${components.join(', ')}) {}`;
  });
  const imports = [
    ...(blocks.some((block) => block.includes('@JsonProperty'))
      ? ['import com.fasterxml.jackson.annotation.JsonProperty;']
      : []),
    ...(usesList ? ['import java.util.List;'] : []),
  ];

  return [...(imports.length ? [imports.join('\n')] : []), ...blocks].join('\n\n');
}

export function renderCSharp(records: CodeRecord[]): string {
  const usings = [
    ...(usesType(records, (type) => type.kind === 'array')
      ? ['using System.Collections.Generic;']
      : []),
    'using System.Text.Json.Serialization;',
  ];
  const blocks = records.map((record) => {
    // A member may not share its enclosing class name (CS0542).
    const names = fieldNames(record, 'pascal', csharpKeywords, record.name);
    const members = record.fields.map((field, index) => {
      const base = renderType(field.type, csharpNames);
      const type = field.nullable || field.optional ? `${base}?` : base;

      return `    [JsonPropertyName(${stringLiteral(field.jsonKey)})]\n    public ${type} ${names[index]} { get; set; }`;
    });

    return [`public class ${record.name}`, '{', members.join('\n\n'), '}'].join('\n');
  });

  return [usings.join('\n'), ...blocks].join('\n\n');
}

function isScalarOrRecord(type: CodeType): boolean {
  return type.kind !== 'any' && type.kind !== 'array';
}

function isOptionalType(field: CodeField): boolean {
  return field.optional && field.type.kind !== 'any';
}

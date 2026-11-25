import {
  ToolError,
  type ToolDefinition,
  type ToolField,
  type ToolFieldCondition,
} from '@devtoolora/core';

type Direction = 'decode' | 'encode';

type ConversionSide = Pick<ToolDefinition, 'fields' | 'run'>;

type ConversionPair = Omit<ToolDefinition, 'fields' | 'freshResults' | 'run' | 'textConversion'> & {
  aliasId: string;
  aliasName: string;
  decode: ConversionSide;
  /** Data on the left of the arrow, such as JSON; encode converts it into `encodedLabel`. */
  decodedLabel: string;
  encode: ConversionSide;
  encodedLabel: string;
};

function conditions(value: ToolField['visibleWhen']): ToolFieldCondition[] {
  if (!value) return [];

  return Array.isArray(value) ? value : [value];
}

function directionField(decodedLabel: string, encodedLabel: string): ToolField {
  return {
    defaultValue: 'encode',
    id: 'mode',
    label: 'Direction',
    options: [
      { label: `${decodedLabel} → ${encodedLabel}`, value: 'encode' },
      { label: `${encodedLabel} → ${decodedLabel}`, value: 'decode' },
    ],
    presentation: 'segmented',
    type: 'select',
  };
}

function mergeSideFields(toolId: string, sides: Record<Direction, ConversionSide>): ToolField[] {
  const fields: ToolField[] = [];

  for (const direction of ['encode', 'decode'] as const) {
    const other = sides[direction === 'encode' ? 'decode' : 'encode'].fields ?? [];

    for (const field of sides[direction].fields ?? []) {
      const twin = other.find((entry) => entry.id === field.id);

      if (twin && twin !== field)
        throw new Error(`${toolId} uses the field id ${field.id} for two different options.`);
      if (twin && direction === 'decode') continue;

      fields.push(
        twin
          ? field
          : ({
              ...field,
              visibleWhen: [{ field: 'mode', is: [direction] }, ...conditions(field.visibleWhen)],
            } as ToolField),
      );
    }
  }

  return fields;
}

export function conversionPair({
  aliasId,
  aliasName,
  decode,
  decodedLabel,
  encode,
  encodedLabel,
  ...tool
}: ConversionPair): [ToolDefinition, ToolDefinition] {
  const sides: Record<Direction, ConversionSide> = { decode, encode };
  const fields = [directionField(decodedLabel, encodedLabel), ...mergeSideFields(tool.id, sides)];

  const canonical: ToolDefinition = {
    ...tool,
    fields,
    freshResults: true,
    run: (input) => {
      const mode = input.fields.mode || 'encode';

      if (mode !== 'encode' && mode !== 'decode')
        throw new ToolError(
          `Choose ${decodedLabel} → ${encodedLabel} or ${encodedLabel} → ${decodedLabel}.`,
        );

      return sides[mode].run(input);
    },
    textConversion: {
      decodedLabel,
      encodedLabel,
      runLabels: { decode: `Convert to ${decodedLabel}`, encode: `Convert to ${encodedLabel}` },
    },
  };
  const alias: ToolDefinition = {
    ...canonical,
    aliasOf: canonical.id,
    fields: fields.map((field) =>
      field.id === 'mode' ? { ...field, defaultValue: 'decode' } : field,
    ),
    id: aliasId,
    name: aliasName,
    run: (input) =>
      canonical.run({ ...input, fields: { ...input.fields, mode: input.fields.mode || 'decode' } }),
  };

  return [canonical, alias];
}

import { ToolDefinition, type ToolField, type ToolResult } from '@devtoolora/core';
import { convertCssUnit, cssUnits, type CssUnit } from '@devtoolora/functions/css';
import { calculatorResult, cssGeneratorDefaults } from '../shared';
import { rangeField, rangedNumber } from '../../../adapters/fields';

const valueField = rangeField({
  defaultValue: '24',
  id: 'value',
  label: 'Value',
  max: 1000000,
  min: -1000000,
  step: 0.0001,
});
const unitField: ToolField = {
  defaultValue: 'px',
  id: 'unit',
  label: 'Unit',
  options: cssUnits.map((value) => ({ label: value, value })),
  type: 'select',
};
const context = (
  id: string,
  label: string,
  defaultValue: string,
  max: number,
  step?: number,
): ToolField => rangeField({ defaultValue, id, label, max, min: 1, step, unit: 'px' });

const rootField = context('rootFontSize', 'Root font size', '16', 100, 0.01);
const parentField = context('parentFontSize', 'Parent font size', '16', 100, 0.01);
const widthField = context('viewportWidth', 'Viewport width', '1440', 10000);
const heightField = context('viewportHeight', 'Viewport height', '900', 10000);

const isCssUnit = (value: string): value is CssUnit => cssUnits.some((unit) => unit === value);

function runConverter(values: Record<string, string>): ToolResult {
  const unit = values.unit ?? 'px';
  const amount = rangedNumber(valueField, values);
  const rows = convertCssUnit(amount, isCssUnit(unit) ? unit : 'px', {
    parentFontSize: rangedNumber(parentField, values),
    rootFontSize: rangedNumber(rootField, values),
    viewportHeight: rangedNumber(heightField, values),
    viewportWidth: rangedNumber(widthField, values),
  });
  const cells = rows.map((row) => `${row.value}${row.unit}`);
  const width = Math.max(...cells.map((cell) => cell.length));
  const text = [`${amount}${unit} =`, ...cells.map((cell) => `  ${cell.padStart(width)}`), ''].join(
    '\n',
  );

  return calculatorResult(
    text,
    'css-units.txt',
    `${amount}${unit} in ${rows.length} other CSS units. % is a percentage of the parent font size.`,
    'plaintext',
  );
}

const sample = (label: string, fields: Record<string, string>) => ({ fields, label });

export const cssUnitConverterTool: ToolDefinition = {
  ...cssGeneratorDefaults,
  description:
    'Convert a CSS length between px, rem, em, %, pt, pc, in, cm, mm, Q and viewport units using your own root, parent and viewport sizes.',
  fields: [valueField, unitField, rootField, parentField, widthField, heightField],
  id: 'css-unit-converter',
  keywords: ['px to rem', 'rem', 'em', 'pixels', 'viewport units', 'vw', 'vh'],
  name: 'CSS Unit Converter',
  relatedToolIds: ['unit-converter', 'css-clamp-generator'],
  run: ({ fields: values }) => runConverter(values),
  samples: [
    sample('24px everywhere', {}),
    sample('1.5rem to px', { unit: 'rem', value: '1.5' }),
    sample('2em in a 20px parent', { parentFontSize: '20', unit: 'em', value: '2' }),
    sample('A4 width 210mm', { unit: 'mm', value: '210' }),
    sample('50vw on mobile', {
      unit: 'vw',
      value: '50',
      viewportHeight: '844',
      viewportWidth: '390',
    }),
    sample('12pt print text', { unit: 'pt', value: '12' }),
  ],
};

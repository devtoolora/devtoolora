import { ToolDefinition, ToolError, type ToolField, type ToolResult } from '@devtoolora/core';
import { barcodeSvg, encodeBarcode, type BarcodeFormat } from '@devtoolora/functions/barcode';
import { base64Encode } from '@devtoolora/functions/binary';
import { withToolError } from '../../../adapters/errors';
import { rangeField, rangedNumber } from '../../../adapters/fields';
import { browserSafeCapabilities } from '../shared';

const formats: { label: string; value: BarcodeFormat }[] = [
  { label: 'Code 128', value: 'code128' },
  { label: 'EAN-13', value: 'ean13' },
  { label: 'UPC-A', value: 'upca' },
  { label: 'Code 39', value: 'code39' },
];
const formatNames: Record<BarcodeFormat, string> = {
  code128: 'Code 128',
  code39: 'Code 39',
  ean13: 'EAN-13',
  upca: 'UPC-A',
};
const moduleWidthField = rangeField({
  defaultValue: '2',
  id: 'moduleWidth',
  label: 'Module width',
  max: 4,
  min: 1,
  step: 1,
  unit: 'px',
});
const heightField = rangeField({
  defaultValue: '80',
  id: 'height',
  label: 'Bar height',
  max: 200,
  min: 20,
  step: 1,
  unit: 'px',
});

const barcodeFields = (defaultFormat: BarcodeFormat): ToolField[] => [
  {
    defaultValue: defaultFormat,
    id: 'format',
    label: 'Format',
    options: formats,
    presentation: 'segmented',
    type: 'select',
  },
  moduleWidthField,
  heightField,
  { defaultValue: 'true', id: 'showText', label: 'Show text', type: 'checkbox' },
  {
    defaultValue: 'false',
    help: 'Adds the mod 43 check character.',
    id: 'code39Check',
    label: 'Code 39 check character',
    type: 'checkbox',
    visibleWhen: { field: 'format', is: ['code39'] },
  },
];

function runBarcode(text: string, values: Record<string, string>, defaultFormat: BarcodeFormat) {
  const format = formats.find((option) => option.value === (values.format ?? defaultFormat));

  if (!format)
    throw new ToolError(`Format must be one of: ${formats.map((f) => f.value).join(', ')}.`);

  const options = {
    format: format.value,
    height: rangedNumber(heightField, values),
    moduleWidth: rangedNumber(moduleWidthField, values),
    showText: values.showText !== 'false',
  };
  // A pasted line usually ends in one line break; other control characters reach the encoder.
  const data = text.replace(/\r?\n$/, '');
  const encoded = withToolError(() =>
    encodeBarcode(format.value, data, { code39Check: values.code39Check === 'true' }),
  );
  const svg = barcodeSvg(encoded, options);
  const parts = [`${formatNames[format.value]}, ${encoded.modules.length} modules`];
  const checkName = format.value === 'code39' ? 'check character' : 'check digit';

  if (encoded.checkDigit) parts.push(`${checkName} ${encoded.checkDigit}`);

  const notes = [
    ...(data === text ? [] : ['The trailing line break was removed.']),
    ...(encoded.note ? [encoded.note] : []),
  ];

  const result: ToolResult = {
    artifact: {
      base64: base64Encode(new TextEncoder().encode(svg)),
      fileName: `barcode-${format.value}.svg`,
      mimeType: 'image/svg+xml',
    },
    language: 'xml',
    previewDataUri: `data:image/svg+xml;base64,${base64Encode(new TextEncoder().encode(svg))}`,
    summary: [`${parts.join(', ')}.`, ...notes].join(' '),
    text: svg,
  };

  return result;
}

const sample = (label: string, text: string, fields: Record<string, string>) => ({
  fields,
  label,
  text,
});

export const barcodeGeneratorTool: ToolDefinition = {
  autoRun: true,
  capabilities: browserSafeCapabilities,
  category: 'Images & Codes',
  description:
    'Generate a Code 128, EAN-13, UPC-A or Code 39 barcode as a downloadable SVG, with check digits calculated and verified.',
  fields: barcodeFields('code128'),
  freshResults: true,
  id: 'barcode-generator',
  inputKind: 'text',
  inputPresentation: {
    label: 'Data',
    placeholder: 'Text for Code 128 or 39, digits for EAN-13 and UPC-A',
  },
  keywords: ['barcode', 'code 128', 'ean 13', 'upc a', 'code 39', 'gtin'],
  name: 'Barcode Generator',
  outputKind: 'text',
  relatedToolIds: ['qr-code-generator', 'svg-to-png', 'svg-optimizer'],
  resultActions: ['copy', 'scratch', 'save'],
  run: ({ fields, text }) => runBarcode(text, fields, 'code128'),
  samples: [
    sample('Code 128 text', 'Wikipedia', { format: 'code128' }),
    sample('Code 128 digits', '1234567890', { format: 'code128' }),
    sample('EAN-13 without check digit', '400638133393', { format: 'ean13' }),
    sample('EAN-13 with separators', '400-638 133393', { format: 'ean13' }),
    sample('UPC-A', '03600029145', { format: 'upca' }),
    sample('Code 39 with check', 'CODE 39', { code39Check: 'true', format: 'code39' }),
  ],
  supportsSelection: true,
};

export const ean13BarcodeGeneratorTool: ToolDefinition = {
  ...barcodeGeneratorTool,
  aliasOf: 'barcode-generator',
  description: 'Generate an EAN-13 barcode SVG from 12 digits, or verify the check digit of 13.',
  fields: barcodeFields('ean13'),
  id: 'ean-13-barcode-generator',
  name: 'EAN-13 Barcode Generator',
  run: ({ fields, text }) => runBarcode(text, fields, 'ean13'),
  samples: [
    sample('12 digits', '400638133393', {}),
    sample('13 digits', '4006381333931', {}),
    sample('With hyphens', '400-638-133393', {}),
    sample('Short bars', '590123412345', { height: '40', moduleWidth: '1' }),
    sample('Wide modules', '978020137962', { moduleWidth: '3' }),
    sample('No text', '400638133393', { showText: 'false' }),
  ],
};

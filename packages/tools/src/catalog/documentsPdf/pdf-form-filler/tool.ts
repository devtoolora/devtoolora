import { ToolDefinition, ToolError, type ToolResult } from '@devtoolora/core';
import { base64Encode } from '@devtoolora/functions/binary';
import * as pdfFunctions from '@devtoolora/functions/pdf';
import { withToolErrorAsync } from '../../../adapters/errors';
import { booleanField } from '../../../adapters/fields';
import {
  browserSafeCapabilities,
  pdfFiles,
  pdfMaxBytes,
  pdfOutput,
  signatureNotes,
} from '../shared';
import { form } from './sample';

const filling = { field: 'mode', is: ['fill'] };
const defaults = { flatten: 'false', mode: 'list', values: '' };
const fillSample = (values: object, flatten = 'false') => ({
  ...defaults,
  ...form,
  flatten,
  mode: 'fill',
  values: JSON.stringify(values),
});

function parseValues(text: string): Record<string, unknown> {
  let parsed: unknown;

  try {
    parsed = JSON.parse(text);
  } catch {
    throw new ToolError('Values must be a JSON object such as {"name": "Ada"}.');
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed))
    throw new ToolError('Values must be a JSON object such as {"name": "Ada"}.');

  return parsed as Record<string, unknown>;
}

function emptyValue(field: pdfFunctions.PdfFormField): unknown {
  if (field.type === 'checkbox') return false;
  if (field.type === 'list') return [];

  return field.type === 'text' ? (field.value ?? '') : null;
}

async function listFields(file: pdfFunctions.PdfFile): Promise<ToolResult> {
  const fields = await withToolErrorAsync(() => pdfFunctions.listPdfFormFields(file));
  const template = Object.fromEntries(
    fields
      .filter((field) => !field.readOnly && field.type !== 'button' && field.type !== 'signature')
      .map((field) => [field.name, field.value ?? emptyValue(field)]),
  );

  const text = JSON.stringify(template, null, 2);

  return {
    jsonTable: {
      columns: ['Name', 'Type', 'Value', 'Options', 'Required', 'Read-only', 'Max length'],
      presentation: 'plain',
      rows: fields.map((field) => [
        field.name,
        field.type,
        field.value === null ? '—' : String(field.value),
        field.options?.join(', ') ?? '—',
        field.required ? 'yes' : 'no',
        field.readOnly ? 'yes' : 'no',
        field.maxLength === undefined ? '—' : String(field.maxLength),
      ]),
    },
    artifact: {
      base64: base64Encode(new TextEncoder().encode(text)),
      fileName: `${pdfFunctions.pdfBaseName(file.name)}-fields.json`,
      mimeType: 'application/json;charset=utf-8',
    },
    language: 'json',
    summary: fields.length
      ? `${fields.length} form ${fields.length === 1 ? 'field' : 'fields'}. Copy the values template, edit it and paste it into Fill mode.`
      : 'No fillable form fields found.',
    text,
  };
}

async function fillFields(
  file: pdfFunctions.PdfFile,
  fields: Record<string, string>,
): Promise<ToolResult> {
  if (!fields.values?.trim())
    return { summary: 'Enter the field values as JSON to fill the form.', text: '' };

  const values = parseValues(fields.values);
  const flatten = booleanField(fields.flatten, false);
  const result = await withToolErrorAsync(() =>
    pdfFunctions.fillPdfForm(file, values, { flatten }),
  );
  const summary = [
    `Filled ${result.filled} of ${result.total} fields`,
    ...(flatten ? ['flattened'] : []),
    ...(result.xfaRemoved ? ['XFA data removed, AcroForm fields filled'] : []),
    ...signatureNotes(file.bytes),
  ].join(' · ');

  return pdfOutput(
    result.bytes,
    `${pdfFunctions.pdfBaseName(file.name)}-filled.pdf`,
    summary,
    file.bytes.length,
  );
}

async function pdfFormFiller(fields: Record<string, string>): Promise<ToolResult> {
  const [file] = pdfFiles(fields, false);

  if (!file) throw new ToolError('PDF file is required.');

  return (fields.mode || 'list') === 'fill' ? fillFields(file, fields) : listFields(file);
}

export const pdfFormFillerTool: ToolDefinition = {
  autoRun: true,
  capabilities: browserSafeCapabilities,
  category: 'Documents & PDF',
  description:
    'List the fillable fields of a PDF form as an editable JSON template, then fill text, checkbox, radio, dropdown and list fields or flatten the result, locally.',
  fields: [
    {
      accept: 'application/pdf',
      id: 'pdfs',
      label: 'PDF form',
      maxBytes: pdfMaxBytes,
      required: true,
      type: 'file',
    },
    {
      defaultValue: 'list',
      id: 'mode',
      label: 'Action',
      options: [
        { label: 'List fields', value: 'list' },
        { label: 'Fill', value: 'fill' },
      ],
      presentation: 'segmented',
      type: 'select',
    },
    {
      help: 'A JSON object of field name to value. Text, dropdown and radio fields take strings, a checkbox takes true or false, an option list takes an array of strings.',
      id: 'values',
      label: 'Values',
      placeholder: '{"name": "Ada Lovelace", "agree": true}',
      type: 'textarea',
      visibleWhen: filling,
    },
    {
      defaultValue: 'false',
      help: 'Turns the fields into plain page content so they can no longer be edited.',
      id: 'flatten',
      label: 'Flatten after filling',
      type: 'checkbox',
      visibleWhen: filling,
    },
  ],
  freshResults: true,
  id: 'pdf-form-filler',
  inputKind: 'none',
  keywords: [
    'fill pdf form',
    'pdf form filler',
    'acroform',
    'fillable pdf',
    'flatten pdf form',
    'pdf form fields',
  ],
  name: 'PDF Form Filler',
  outputKind: 'text',
  relatedToolIds: ['pdf-toolkit', 'pdf-metadata-editor', 'pdf-text-extractor'],
  resultActions: ['copy', 'save'],
  run: ({ fields }) => pdfFormFiller(fields),
  samples: [
    { fields: { ...defaults, ...form }, label: 'List the form fields' },
    { fields: fillSample({ fullName: 'Ada Lovelace' }), label: 'Fill the name' },
    {
      fields: fillSample({ country: 'CZ', fullName: 'Žluťoučký kůň' }),
      label: 'Fill Czech text and a dropdown',
    },
    { fields: fillSample({ size: 'M' }), label: 'Pick a radio option' },
    {
      fields: fillSample({ country: 'SK', fullName: 'Grace Hopper', size: 'S' }, 'true'),
      label: 'Fill everything and flatten',
    },
    { fields: fillSample({}, 'true'), label: 'Flatten the empty form' },
  ],
  supportsSelection: false,
};

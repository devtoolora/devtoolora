import type { PDFDocument, PDFField, PDFForm, PDFFont, PDFOptionList } from 'pdf-lib';
import { base64Decode } from '../binary';
import { openPdf, pdfError, type PdfFile } from './document';
import {
  codePointLabel,
  embedBundledFont,
  splitFontRuns,
  type CoveredFont,
  type FontRun,
} from './fontRuns';

export type PdfFormField = {
  maxLength?: number;
  name: string;
  options?: string[];
  readOnly: boolean;
  required: boolean;
  type: 'button' | 'checkbox' | 'dropdown' | 'list' | 'radio' | 'signature' | 'text';
  value: boolean | string | string[] | null;
};

type PdfLib = typeof import('pdf-lib');

export async function listPdfFormFields(file: PdfFile): Promise<PdfFormField[]> {
  const pdfLib = await import('pdf-lib');
  const pdf = await openPdf(file);

  return describeFields(pdfLib, pdf);
}

export async function fillPdfForm(
  file: PdfFile,
  values: Record<string, unknown>,
  options: { flatten: boolean },
): Promise<{ bytes: Uint8Array; filled: number; total: number; xfaRemoved: boolean }> {
  const pdfLib = await import('pdf-lib');
  const pdf = await openPdf(file);
  const { form, xfaRemoved } = openForm(pdf, pdfLib);
  const fields = new Map(form.getFields().map((field) => [field.getName(), field]));

  if (fields.size === 0) throw pdfError(`${file.name} has no fillable form fields.`);

  // Viewers rebuild appearances from /DA (Helvetica) when this flag is set, garbling other scripts.
  pdf.catalog
    .lookupMaybe(pdfLib.PDFName.of('AcroForm'), pdfLib.PDFDict)
    ?.delete(pdfLib.PDFName.of('NeedAppearances'));

  const fonts = fontPool(pdf);
  let filled = 0;

  for (const [name, value] of Object.entries(values)) {
    const field = fields.get(name);

    if (!field) throw pdfError(unknownFieldMessage(name, [...fields.keys()]));

    if (value === null) continue;

    await applyValue(pdfLib, { field, fonts, name, pdf }, value);
    filled += 1;
  }

  for (const [name, field] of fields)
    await drawUntouched(pdfLib, { field, fonts, name, pdf }, values);

  try {
    if (options.flatten) form.flatten();

    return { bytes: await pdf.save(), filled, total: fields.size, xfaRemoved };
  } catch (error) {
    throw pdfError(
      `${file.name} could not be written: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

// pdf-lib warns via console.warn on XFA data, so the key is dropped before getForm().
function openForm(pdf: PDFDocument, pdfLib: PdfLib): { form: PDFForm; xfaRemoved: boolean } {
  const acroForm = pdf.catalog.lookupMaybe(pdfLib.PDFName.of('AcroForm'), pdfLib.PDFDict);
  const xfaRemoved = acroForm?.has(pdfLib.PDFName.of('XFA')) ?? false;

  acroForm?.delete(pdfLib.PDFName.of('XFA'));

  return { form: pdf.getForm(), xfaRemoved };
}

function describeFields(pdfLib: PdfLib, pdf: PDFDocument): PdfFormField[] {
  return openForm(pdf, pdfLib)
    .form.getFields()
    .map((field): PdfFormField => {
      const base = {
        name: field.getName(),
        readOnly: field.isReadOnly(),
        required: field.isRequired(),
      };

      if (field instanceof pdfLib.PDFTextField) {
        const maxLength = field.getMaxLength();

        return {
          ...base,
          ...(maxLength === undefined ? {} : { maxLength }),
          type: 'text',
          value: field.getText() ?? null,
        };
      }

      if (field instanceof pdfLib.PDFCheckBox)
        return { ...base, type: 'checkbox', value: field.isChecked() };

      if (field instanceof pdfLib.PDFRadioGroup)
        return {
          ...base,
          options: field.getOptions(),
          type: 'radio',
          value: field.getSelected() ?? null,
        };

      if (field instanceof pdfLib.PDFDropdown) {
        const [selected] = field.getSelected();

        return { ...base, options: field.getOptions(), type: 'dropdown', value: selected ?? null };
      }

      if (field instanceof pdfLib.PDFOptionList)
        return { ...base, options: field.getOptions(), type: 'list', value: field.getSelected() };

      return {
        ...base,
        type: field instanceof pdfLib.PDFSignature ? 'signature' : 'button',
        value: null,
      };
    });
}

function unknownFieldMessage(name: string, known: string[]): string {
  const shown = known.slice(0, 20).join(', ');

  return `Unknown form field "${name}". Known fields: ${shown}${known.length > 20 ? ', ...' : ''}.`;
}

type FontPool = (name: string, text: string, existing: boolean) => Promise<FontRun[]>;
type Target = { field: PDFField; fonts: FontPool; name: string; pdf: PDFDocument };

const plain = /^[\x20-\x7e]*$/;

const missingCharacter = (name: string, existing: boolean) => (character: string, code: number) =>
  pdfError(
    existing
      ? `Form field "${name}" already contains "${character}" (${codePointLabel(code)}), which the bundled font cannot show; clear it or leave the form unfilled.`
      : `Form field "${name}" contains "${character}" (${codePointLabel(code)}), which is not in the bundled font covering Latin and Latin Extended scripts.`,
  );

function fontPool(pdf: PDFDocument): FontPool {
  type Entry = { base64: string; characters: Set<number>; covered?: Promise<CoveredFont> };
  let loaded: Promise<Entry[]> | undefined;

  const load = async (): Promise<Entry[]> => {
    const [fontkit, { pdfFontData }] = await Promise.all([
      import('@pdf-lib/fontkit'),
      import('./fonts.generated'),
    ]);

    pdf.registerFontkit(fontkit.default);

    return pdfFontData
      .filter((entry) => !entry.bold)
      .map((entry) => ({
        base64: entry.base64,
        characters: new Set(
          (fontkit.default.create(base64Decode(entry.base64)) as { characterSet: number[] })
            .characterSet,
        ),
      }));
  };

  return async (name, text, existing) => {
    loaded ??= load();

    const entries = await loaded;
    const missing = missingCharacter(name, existing);
    const used = new Set<Entry>();

    for (const character of text) {
      const code = character.codePointAt(0) ?? 0;

      if (code === 0x20) continue;

      const entry = entries.find((item) => item.characters.has(code));

      if (entry) used.add(entry);
      else throw missing(character, code);
    }

    if (used.size === 0) return [];

    const chosen = entries.filter((entry) => used.has(entry));

    const covered: Array<Promise<CoveredFont>> = [];

    for (const entry of chosen) {
      entry.covered ??= embedBundledFont(pdf, entry.base64);
      covered.push(entry.covered);
    }

    return splitFontRuns(text, await Promise.all(covered), missing, true);
  };
}

// shortcut: no word wrap for non-ASCII text; upgrade if long multiline values matter.
async function drawRuns(
  pdfLib: PdfLib,
  { field, fonts, name, pdf }: Target,
  text: string,
  existing = false,
): Promise<void> {
  const lines = await Promise.all(text.split('\n').map((line) => fonts(name, line, existing)));
  const multiline = field instanceof pdfLib.PDFTextField && field.isMultiline();
  const maxLength = field instanceof pdfLib.PDFTextField ? field.getMaxLength() : undefined;
  const comb = field instanceof pdfLib.PDFTextField && field.isCombed() && maxLength !== undefined;
  const alignment = field instanceof pdfLib.PDFTextField ? field.getAlignment() : 0;
  const used = [...new Set(lines.flat().map((run) => run.font))];
  const key = (font: PDFFont) => `NF${used.indexOf(font)}`;
  const lineWidth = (runs: FontRun[], size: number) =>
    runs.reduce((sum, run) => sum + run.font.widthOfTextAtSize(run.text, size), 0);

  for (const widget of field.acroField.getWidgets()) {
    const { height, width } = widget.getRectangle();
    let size = multiline ? 10 : Math.max(4, Math.min(12, height - 4));

    while (!comb && size > 4 && Math.max(...lines.map((line) => lineWidth(line, size))) > width - 4)
      size -= 0.5;

    const operators = lines.flatMap((line, index) => {
      const baseline = multiline
        ? height - 2 - size * 0.85 - index * size * 1.15
        : (height - size) / 2 + size * 0.22;
      const total = lineWidth(line, size);
      let x = [2, (width - total) / 2, width - 2 - total][alignment] ?? 2;
      const place = (run: FontRun, at: number) =>
        `BT /${key(run.font)} ${size} Tf ${at.toFixed(2)} ${baseline.toFixed(2)} Td ${run.font.encodeText(run.text).toString()} Tj ET`;

      if (comb && maxLength) {
        const cell = width / maxLength;

        return line
          .flatMap((run) => Array.from(run.text, (character) => ({ ...run, text: character })))
          .map((run, at) =>
            place(run, at * cell + (cell - run.font.widthOfTextAtSize(run.text, size)) / 2),
          );
      }

      return line.map((run) => {
        const operator = place(run, x);

        x += run.font.widthOfTextAtSize(run.text, size);

        return operator;
      });
    });
    const stream = pdf.context.stream(
      `/Tx BMC q 1 1 ${width - 2} ${height - 2} re W n ${operators.join(' ')} Q EMC`,
      {
        BBox: [0, 0, width, height],
        Resources: { Font: Object.fromEntries(used.map((font) => [key(font), font.ref])) },
        Subtype: 'Form',
        Type: 'XObject',
      },
    );

    widget.setNormalAppearance(pdf.context.register(stream));
  }

  // pdf-lib keeps markAsClean protected; calling it stops save() from redrawing with WinAnsi.
  (field as unknown as { markAsClean(): void }).markAsClean();
}

// Prefilled non-ASCII values without an appearance would be redrawn by pdf-lib in WinAnsi.
async function drawUntouched(
  pdfLib: PdfLib,
  target: Target,
  values: Record<string, unknown>,
): Promise<void> {
  const { field, name } = target;

  if (Object.hasOwn(values, name) && values[name] !== null) return;

  let current: string | undefined;

  if (field instanceof pdfLib.PDFTextField) current = field.getText();
  else if (field instanceof pdfLib.PDFDropdown) [current] = field.getSelected();

  const missing = field.acroField.getWidgets().some((widget) => !widget.getAppearances()?.normal);

  if (current && missing && !plain.test(current.replace(/[\r\n\t]/g, ' ')))
    await drawRuns(pdfLib, target, current.replace(/\r\n?/g, '\n'), true);
}

async function applyValue(pdfLib: PdfLib, target: Target, value: unknown): Promise<void> {
  const { field, name } = target;

  if (field.isReadOnly()) throw pdfError(`Form field "${name}" is read-only.`);

  if (field instanceof pdfLib.PDFCheckBox) {
    if (typeof value !== 'boolean') throw typeError(name, 'a boolean');

    if (value) field.check();
    else field.uncheck();
  } else if (field instanceof pdfLib.PDFTextField) {
    if (typeof value !== 'string') throw typeError(name, 'a string');

    const text = normalizeText(name, value, field.isMultiline());
    const max = field.getMaxLength();

    if (max !== undefined && text.length > max)
      throw pdfError(
        `Form field "${name}" allows at most ${max} characters, but the value has ${text.length}.`,
      );

    await setText(target, text, () => field.setText(text), pdfLib);
  } else if (field instanceof pdfLib.PDFRadioGroup) {
    if (typeof value !== 'string') throw typeError(name, 'a string');

    checkOptions(name, [value], field.getOptions(), false);
    field.select(value);
  } else if (field instanceof pdfLib.PDFDropdown) {
    if (typeof value !== 'string') throw typeError(name, 'a string');

    const text = normalizeText(name, value, false);

    checkOptions(name, [text], field.getOptions(), field.isEditable());
    await setText(target, text, () => field.select(text), pdfLib);
  } else if (field instanceof pdfLib.PDFOptionList) {
    applyList(field, name, value);
  } else {
    throw pdfError(`Form field "${name}" is a button or signature field and cannot be filled.`);
  }
}

function applyList(field: PDFOptionList, name: string, value: unknown): void {
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string'))
    throw typeError(name, 'an array of strings');

  const items = value as string[];
  const options = field.getOptions();

  checkOptions(name, items, options, false);

  // pdf-lib draws every option of a list, so one non-ASCII option breaks the WinAnsi appearance.
  for (const option of options) {
    const character = Array.from(option).find((item) => !plain.test(item));

    if (character) {
      throw pdfError(
        `Form field "${name}" is an option list with the option "${option}", which contains "${character}" (${codePointLabel(character.codePointAt(0) ?? 0)}); option lists with non-ASCII options are not supported.`,
      );
    }
  }

  field.select(items);
}

async function setText(
  target: Target,
  text: string,
  assign: () => void,
  pdfLib: PdfLib,
): Promise<void> {
  assign();

  if (!plain.test(text.replace(/\n/g, ' '))) await drawRuns(pdfLib, target, text);
}

function normalizeText(name: string, value: string, multiline: boolean): string {
  const text = value.replace(/\t/g, ' ').replace(/\r\n?/g, '\n');

  if (!multiline && text.includes('\n'))
    throw pdfError(
      `Form field "${name}" is a single-line field, so its value cannot contain line breaks.`,
    );

  return text;
}

function typeError(name: string, expected: string): Error {
  return pdfError(`Form field "${name}" needs ${expected} value.`);
}

function checkOptions(name: string, items: string[], options: string[], editable: boolean): void {
  if (editable) return;

  for (const item of items) {
    if (!options.includes(item))
      throw pdfError(
        `"${item}" is not an option of form field "${name}". Options: ${options.join(', ')}.`,
      );
  }
}

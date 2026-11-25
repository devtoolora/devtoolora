import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { PDFBool, PDFDict, PDFDocument, PDFName } from 'pdf-lib';
import { extractPdfText, fillPdfForm, listPdfFormFields } from '../src/pdf';

async function formPdf(): Promise<{ bytes: Uint8Array; name: string }> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([300, 400]);
  const form = doc.getForm();
  const place = (y: number) => ({ height: 20, width: 150, x: 20, y });

  form.createTextField('name').setMaxLength(20);
  form.getTextField('name').addToPage(page, place(350));
  form.createCheckBox('agree').addToPage(page, { height: 15, width: 15, x: 20, y: 320 });
  form.createDropdown('country').addOptions(['CZ', 'SK']);
  form.getDropdown('country').addToPage(page, place(280));
  form.createRadioGroup('size');
  form.getRadioGroup('size').addOptionToPage('S', page, { height: 15, width: 15, x: 20, y: 250 });
  form.getRadioGroup('size').addOptionToPage('M', page, { height: 15, width: 15, x: 50, y: 250 });
  form.createOptionList('tags').addOptions(['a', 'b', 'c']);
  form.getOptionList('tags').enableMultiselect();
  form.getOptionList('tags').addToPage(page, { height: 50, width: 100, x: 20, y: 180 });
  form.createTextField('id').setText('A1');
  form.getTextField('id').enableReadOnly();
  form.getTextField('id').addToPage(page, place(140));

  return { bytes: await doc.save(), name: 'form.pdf' };
}

const fill = async (values: Record<string, unknown>, flatten = false) =>
  fillPdfForm(await formPdf(), values, { flatten });

describe('pdf forms', () => {
  it('lists the fields in document order', async () => {
    const fields = await listPdfFormFields(await formPdf());

    assert.deepEqual(
      fields.map((field) => [field.name, field.type]),
      [
        ['name', 'text'],
        ['agree', 'checkbox'],
        ['country', 'dropdown'],
        ['size', 'radio'],
        ['tags', 'list'],
        ['id', 'text'],
      ],
    );

    assert.equal(fields[0]?.maxLength, 20);
    assert.deepEqual(fields[2]?.options, ['CZ', 'SK']);
    assert.equal(fields[5]?.readOnly, true);
    assert.equal(fields[5]?.value, 'A1');
  });

  it('fills every kind of field, including Latin Extended text', async () => {
    const out = await fill({
      agree: true,
      country: 'SK',
      name: 'Žluťoučký kůň',
      size: 'M',
      tags: ['a', 'c'],
    });
    const form = (await PDFDocument.load(out.bytes)).getForm();

    assert.equal(out.filled, 5);
    assert.equal(out.total, 6);
    assert.equal(form.getTextField('name').getText(), 'Žluťoučký kůň');
    assert.ok(form.getTextField('name').acroField.getWidgets()[0]?.getAppearances()?.normal);
    assert.equal(form.getCheckBox('agree').isChecked(), true);
    assert.deepEqual(form.getDropdown('country').getSelected(), ['SK']);
    assert.equal(form.getRadioGroup('size').getSelected(), 'M');
    assert.deepEqual(form.getOptionList('tags').getSelected(), ['a', 'c']);
  });

  it('rejects bad values with messages naming the problem', async () => {
    await assert.rejects(fill({ nope: 'x' }), /Unknown form field "nope".*name, agree/);
    await assert.rejects(fill(JSON.parse('{"__proto__":"x"}')), /Unknown form field "__proto__"/);
    await assert.rejects(fill({ constructor: 'x' }), /Unknown form field "constructor"/);
    await assert.rejects(fill({ agree: 'yes' }), /"agree" needs a boolean/);
    await assert.rejects(fill({ country: 'PL' }), /"PL" is not an option of form field "country"/);
    await assert.rejects(fill({ name: 'x'.repeat(21) }), /"name" allows at most 20/);
    await assert.rejects(fill({ id: '1' }), /"id" is read-only/);
    await assert.rejects(fill({ name: '日本' }), /"name" contains "日" \(U\+65E5\)/);
  });

  it('flattens the filled form', async () => {
    const out = await fill({ name: 'Žluťoučký kůň' }, true);

    assert.equal((await PDFDocument.load(out.bytes)).getForm().getFields().length, 0);

    const text = await extractPdfText(
      { bytes: out.bytes, name: 'x.pdf' },
      { pageMarkers: false, pages: '' },
    );

    assert.match(text.text, /Žluťoučký kůň/);
  });

  it('removes XFA and reports it', async () => {
    const file = await formPdf();
    const doc = await PDFDocument.load(file.bytes);
    const acro = doc.catalog.lookup(PDFName.of('AcroForm'));

    (acro as unknown as { set(key: PDFName, value: unknown): void }).set(
      PDFName.of('XFA'),
      doc.context.obj([]),
    );

    const out = await fillPdfForm(
      { bytes: await doc.save(), name: 'x.pdf' },
      { name: 'a' },
      { flatten: false },
    );

    assert.equal(out.xfaRemoved, true);

    assert.equal(
      (await PDFDocument.load(out.bytes)).catalog
        .lookup(PDFName.of('AcroForm'), PDFDict)
        .has(PDFName.of('XFA')),
      false,
    );

    assert.equal((await fill({ name: 'a' })).xfaRemoved, false);
  });

  it('lists nothing and refuses to fill a PDF without a form', async () => {
    const doc = await PDFDocument.create();

    doc.addPage();

    const file = { bytes: await doc.save(), name: 'plain.pdf' };

    assert.deepEqual(await listPdfFormFields(file), []);
    await assert.rejects(fillPdfForm(file, {}, { flatten: false }), /no fillable form fields/);
  });

  it('treats null as leave unchanged and lets a listed template round-trip', async () => {
    const out = await fill({ agree: null, country: null, name: 'Ada', size: null, tags: [] });

    assert.equal(out.filled, 2);
  });

  it('drops NeedAppearances and keeps the custom appearance', async () => {
    const file = await formPdf();
    const doc = await PDFDocument.load(file.bytes);

    doc.catalog
      .lookup(PDFName.of('AcroForm'), PDFDict)
      .set(PDFName.of('NeedAppearances'), PDFBool.True);

    const out = await fillPdfForm(
      { bytes: await doc.save(), name: 'x.pdf' },
      { name: 'Žluťoučký kůň' },
      { flatten: false },
    );
    const saved = await PDFDocument.load(out.bytes);

    assert.equal(
      saved.catalog.lookup(PDFName.of('AcroForm'), PDFDict).has(PDFName.of('NeedAppearances')),
      false,
    );

    assert.ok(
      saved.getForm().getTextField('name').acroField.getWidgets()[0]?.getAppearances()?.normal,
    );
  });

  it('rejects non-ASCII list options and survives untouched non-ASCII fields', async () => {
    const doc = await PDFDocument.create();
    const page = doc.addPage([300, 300]);
    const form = doc.getForm();
    const list = form.createOptionList('city');
    const city = form.createTextField('city2');
    const other = form.createTextField('other');

    list.addToPage(page, { height: 40, width: 80, x: 10, y: 200 });
    city.addToPage(page, { height: 20, width: 100, x: 10, y: 150 });
    other.addToPage(page, { height: 20, width: 100, x: 10, y: 100 });
    list.addOptions(['Brno', 'Plzeň']);
    city.setText('Plzeň');

    for (const field of [city, other])
      for (const widget of field.acroField.getWidgets()) widget.dict.delete(PDFName.of('AP'));

    const file = { bytes: await doc.save({ updateFieldAppearances: false }), name: 'c.pdf' };

    await assert.rejects(fillPdfForm(file, { city: ['Brno'] }, { flatten: false }), /"city".*"ň"/);

    const out = await fillPdfForm(file, { other: 'x' }, { flatten: false });

    assert.equal(
      (await PDFDocument.load(out.bytes)).getForm().getTextField('city2').getText(),
      'Plzeň',
    );
  });

  it('handles line breaks, tabs and alignment', async () => {
    const doc = await PDFDocument.create();
    const page = doc.addPage([300, 300]);
    const form = doc.getForm();
    const multi = form.createTextField('multi');
    const right = form.createTextField('right');

    multi.enableMultiline();
    multi.addToPage(page, { height: 60, width: 100, x: 10, y: 200 });
    right.setAlignment(2);
    right.addToPage(page, { height: 20, width: 100, x: 10, y: 150 });

    const file = { bytes: await doc.save(), name: 'm.pdf' };
    const out = await fillPdfForm(
      file,
      { multi: 'a\r\nb\tc', right: 'Žluťoučký' },
      { flatten: false },
    );
    const saved = (await PDFDocument.load(out.bytes)).getForm();

    assert.equal(saved.getTextField('multi').getText(), 'a\nb c');

    await assert.rejects(
      fillPdfForm(file, { right: 'a\nb' }, { flatten: false }),
      /"right" is a single-line field/,
    );

    const multiCzech = await fillPdfForm(file, { multi: 'Žlu\nkůň' }, { flatten: false });

    assert.equal(
      (await PDFDocument.load(multiCzech.bytes)).getForm().getTextField('multi').getText(),
      'Žlu\nkůň',
    );
  });

  it('embeds each font subset once per document', async () => {
    const doc = await PDFDocument.create();
    const page = doc.addPage([300, 300]);
    const form = doc.getForm();

    for (const [index, name] of ['one', 'many', 'spaced', 'old'].entries()) {
      const field = form.createTextField(name);

      if (name !== 'one') field.enableMultiline();

      field.addToPage(page, { height: 60, width: 100, x: 10, y: 10 + index * 70 });
    }

    const old = form.getTextField('old');

    old.setText('日');
    for (const widget of old.acroField.getWidgets()) widget.dict.delete(PDFName.of('AP'));

    const file = { bytes: await doc.save({ updateFieldAppearances: false }), name: 'f.pdf' };

    const descriptors = async (values: Record<string, unknown>, from = file) => {
      const out = await fillPdfForm(from, { ...values, old: '' }, { flatten: false });
      const loaded = await PDFDocument.load(out.bytes);

      return [...loaded.context.enumerateIndirectObjects()].filter(
        ([, object]) =>
          object instanceof PDFDict &&
          object.get(PDFName.of('Type')) === PDFName.of('FontDescriptor'),
      ).length;
    };

    assert.equal(await descriptors({ many: 'Ž\nŽ\nŽ\nŽ' }), await descriptors({ one: 'Ž' }));
    assert.equal(await descriptors({ many: 'Ž Ž' }), await descriptors({ one: 'Ž' }));

    await assert.rejects(
      fillPdfForm(file, { one: 'a' }, { flatten: false }),
      /"old" already contains "日" \(U\+65E5\).*clear it/,
    );
  });
});

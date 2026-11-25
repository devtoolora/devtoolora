import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { generateTable, type TableOptions } from '../src/format';

const csv = 'name,age\nAda,36\nGrace,85';
const table = (input: string, options: Partial<TableOptions>) =>
  generateTable(input, {
    align: 'left',
    format: 'auto',
    header: true,
    output: 'markdown',
    ...options,
  }).text;

describe('table generator', () => {
  it('writes padded Markdown with alignment rows', () => {
    assert.equal(
      table(csv, {}),
      '| name  | age |\n| :---- | :-- |\n| Ada   | 36  |\n| Grace | 85  |\n',
    );

    assert.equal(
      table(csv, { align: 'right' }),
      '|  name | age |\n| ----: | --: |\n|   Ada |  36 |\n| Grace |  85 |\n',
    );

    assert.equal(
      table(csv, { align: 'center' }),
      '| name  | age |\n| :---: | :-: |\n|  Ada  | 36  |\n| Grace | 85  |\n',
    );
  });

  it('writes HTML and text tables', () => {
    assert.equal(
      table('k,v\na,<b>', { output: 'html' }),
      '<table>\n  <thead>\n    <tr>\n      <th>k</th>\n      <th>v</th>\n    </tr>\n  </thead>\n  <tbody>\n    <tr>\n      <td>a</td>\n      <td>&lt;b&gt;</td>\n    </tr>\n  </tbody>\n</table>\n',
    );

    assert.match(
      table('k\na', { align: 'center', output: 'html' }),
      /<th style="text-align: center">k<\/th>/,
    );

    assert.equal(
      table(csv, { output: 'ascii' }),
      '+-------+-----+\n| name  | age |\n+-------+-----+\n| Ada   | 36  |\n| Grace | 85  |\n+-------+-----+\n',
    );

    assert.equal(
      table(csv, { output: 'unicode' }),
      '┌───────┬─────┐\n│ name  │ age │\n├───────┼─────┤\n│ Ada   │ 36  │\n│ Grace │ 85  │\n└───────┴─────┘\n',
    );

    assert.equal(
      table('a\n"x\ny"', { output: 'ascii' }),
      '+-----+\n| a   |\n+-----+\n| x y |\n+-----+\n',
    );

    assert.equal(table('a\n"x\ny"', {}), '| a      |\n| :----- |\n| x<br>y |\n');
  });

  it('reads JSON records and arrays', () => {
    assert.equal(
      table('[{"a":1.50,"b":"x|y"},{"c":null}]', {}),
      '| a    | b        | c    |\n| :--- | :------- | :--- |\n| 1.50 | x&#124;y |      |\n|      |          | null |\n',
    );

    assert.equal(table('[["k","v"],["a",1]]', {}), '| k   | v   |\n| :-- | :-- |\n| a   | 1   |\n');

    assert.equal(
      table('a,b', { header: false }),
      '| Column 1 | Column 2 |\n| :------- | :------- |\n| a        | b        |\n',
    );

    assert.equal(
      generateTable(csv, { align: 'left', format: 'auto', header: true, output: 'html' }).rows,
      2,
    );

    assert.throws(() => table('{"a":1}', {}), {
      message: 'JSON input must be an array of objects or an array of arrays.',
    });

    assert.throws(() => table('[]', {}), { message: 'The table has no columns.' });

    assert.throws(() => table('[1,2]', { format: 'json' }), {
      message: 'Row 1 must be an object or an array, not number.',
    });
  });

  it('pads ragged CSV rows and names missing headers', () => {
    assert.equal(
      table('a\n1,2\n3', {}),
      '| a   | Column 2 |\n| :-- | :------- |\n| 1   | 2        |\n| 3   |          |\n',
    );
  });

  it('counts code points, escapes HTML quotes and respects the format choice', () => {
    assert.equal(table('a\n😀', { output: 'ascii' }), '+---+\n| a |\n+---+\n| 😀 |\n+---+\n');
    assert.match(table('a\n"""q"""', { output: 'html' }), /<td>&quot;q&quot;<\/td>/);
    assert.equal(table('[1]', { format: 'csv' }), '| &#91;1&#93; |\n| :---------- |\n');
    assert.throws(() => table('a', { format: 'json' }), { name: 'FunctionError' });

    assert.throws(() => table('[{"a":1},[2]]', {}), {
      message: 'Row 2 must be an object, not array.',
    });
  });

  it('rejects oversized tables', () => {
    const wide = Array.from({ length: 1_001 }, (_, i) => i).join(',');

    assert.throws(() => table(`${wide}\n`, {}), {
      message: 'The table is limited to 1,000 columns.',
    });

    assert.throws(() => table(`${'x'.repeat(5_000_001)}`, { format: 'json' }), {
      message: 'The input is limited to 5,000,000 characters.',
    });

    const padded = `a\n${'x'.repeat(1_000_000)}${'\n1'.repeat(24)}`;

    assert.throws(() => table(padded, {}), {
      message: 'The table output is limited to 20,000,000 characters.',
    });

    const manyRows = (count: number, row: string) => `[["a"]${`,${row}`.repeat(count)}]`;

    assert.throws(() => table(manyRows(300_000, '[1]'), {}), {
      message: 'The table is limited to 100,000 rows.',
    });

    assert.throws(() => table(manyRows(1_500_000, '[]'), {}), {
      message: 'The table is limited to 100,000 rows.',
    });

    assert.equal(
      generateTable(manyRows(100_000, '[1]'), {
        align: 'left',
        format: 'json',
        header: true,
        output: 'markdown',
      }).rows,
      100_000,
    );

    const cells = (rows: number, columns: number) =>
      `[[${'1,'.repeat(columns - 1)}1]${`,[${'1,'.repeat(columns - 1)}1]`.repeat(rows - 1)}]`;

    assert.throws(() => table(cells(1_001, 1_000), {}), {
      message: 'The table is limited to 1,000,000 cells.',
    });
  });

  it('treats blank input as a table without columns', () => {
    for (const input of ['', '   ', '\n \n']) {
      assert.throws(() => table(input, {}), /no columns/);
      assert.throws(() => table(input, { format: 'csv', header: false }), /no columns/);
    }
  });
});

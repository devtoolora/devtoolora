import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { sortLinesTool } from '../src/catalog/text';
import { contentOf } from './toolContent';

describe('Sort Lines tool', () => {
  it('exports exact text, stable ties and original mixed terminators', async () => {
    const result = await sortLinesTool.run({ fields: {}, text: 'zebra\r\nalpha\rbeta\n' });

    assert.equal(result.text, 'alpha\r\nbeta\rzebra\n');
    assert.equal(result.artifact?.fileName, 'sorted-lines.txt');

    assert.equal(
      Buffer.from(result.artifact?.base64 ?? '', 'base64').toString('utf8'),
      result.text,
    );

    assert.match(result.summary ?? '', /3 input physical lines.*locale en/);
    const ties = await sortLinesTool.run({
      fields: { accentSensitive: 'false', direction: 'desc' },
      text: 'résumé\nresume\nRESUME',
    });

    assert.equal(ties.text, 'résumé\nresume\nRESUME');
    const joined = await sortLinesTool.run({
      fields: { blankLines: 'first' },
      text: 'z\rx\n\n\nb\n',
    });

    assert.match(joined.summary ?? '', /5 input physical lines.*4 output physical lines.*Warning:/);

    assert.equal(
      Buffer.from(joined.artifact?.base64 ?? '', 'base64').toString('utf8'),
      '\r\nb\nx\nz\n',
    );
  });

  it('provides complete samples and explanations including valid empty results', async () => {
    assert.equal(contentOf(sortLinesTool).documentation?.length, 2);

    for (const sample of sortLinesTool.samples ?? []) {
      assert.equal(Object.keys(sample.fields ?? {}).length, 8);
      const result = await sortLinesTool.run({
        fields: sample.fields ?? {},
        text: sample.text ?? '',
      });

      assert.equal(
        Buffer.from(result.artifact?.base64 ?? '', 'base64').toString('utf8'),
        result.text,
      );
    }

    assert.equal((await sortLinesTool.run({ fields: {}, text: '' })).artifact?.base64, '');

    assert.equal(
      (await sortLinesTool.run({ fields: { blankLines: 'remove' }, text: ' \t\r\n' })).artifact
        ?.base64,
      '',
    );
  });

  it('validates active options without changing malformed requests silently', async () => {
    const invalid: Array<Record<string, string>> = [
      { accentSensitive: 'yes' },
      { blankLines: 'bad' },
      { direction: 'bad' },
      { locale: 'en_US' },
      { numeric: 'yes' },
      { ordering: 'bad' },
      { trimComparison: 'yes' },
    ];

    for (const fields of invalid)
      await assert.rejects(
        async () => sortLinesTool.run({ fields, text: 'b\na' }),
        /Choose|valid, supported|must be true or false/,
      );

    assert.equal(
      (
        await sortLinesTool.run({
          fields: {
            accentSensitive: 'bad',
            caseSensitive: 'bad',
            locale: 'bad_locale',
            numeric: 'bad',
            ordering: 'code-points',
          },
          text: 'b\na',
        })
      ).text,
      'a\nb',
    );
  });
});

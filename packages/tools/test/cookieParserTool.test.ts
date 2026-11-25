import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { cookieParserTool } from '../src/catalog/webApi';
import { contentOf } from './toolContent';
import { result } from './tools.helpers';

const fieldDefaults = Object.fromEntries(
  (cookieParserTool.fields ?? []).map(({ defaultValue, id }) => [id, defaultValue ?? '']),
);

describe('cookie parser tool', () => {
  it('declares its fields', () => {
    assert.equal(cookieParserTool.id, 'cookie-parser');
    assert.equal(cookieParserTool.name, 'Cookie Parser & Set-Cookie Builder');
    assert.equal(cookieParserTool.category, 'Web/API');
    assert.equal(cookieParserTool.inputKind, 'text');
    assert.equal(cookieParserTool.outputKind, 'json');

    assert.deepEqual(
      cookieParserTool.fields?.map(({ defaultValue, id, label }) => [id, label, defaultValue]),
      [
        ['mode', 'Mode', 'parse'],
        ['name', 'Name', ''],
        ['value', 'Value', ''],
        ['domain', 'Domain', ''],
        ['path', 'Path', '/'],
        ['expires', 'Expires', ''],
        ['maxAge', 'Max-Age (seconds)', ''],
        ['secure', 'Secure', 'true'],
        ['httpOnly', 'HttpOnly', 'true'],
        ['sameSite', 'SameSite', 'Lax'],
        ['partitioned', 'Partitioned', 'false'],
      ],
    );

    assert.deepEqual(cookieParserTool.relatedToolIds, [
      'http-headers-parser',
      'jwt-parse',
      'secret-redactor',
    ]);

    assert.ok((contentOf(cookieParserTool).faq?.length ?? 0) >= 4);
    assert.equal(cookieParserTool.samples?.length, 6);
  });

  it('runs every sample', async () => {
    const summaries: string[] = [];

    for (const sample of cookieParserTool.samples ?? []) {
      const output = await result('cookie-parser', sample.text ?? '', {
        ...fieldDefaults,
        ...sample.fields,
      });

      assert.ok(output.text);
      assert.ok(output.summary);
      summaries.push(output.summary ?? '');
    }

    assert.equal(summaries[0], '1 cookie · no findings');
    assert.equal(summaries[1], '3 cookies · no findings');
    assert.equal(summaries[5], 'Set-Cookie built · no findings');
  });

  it('exports the artifact', async () => {
    const sample = cookieParserTool.samples?.[0];
    const output = await result('cookie-parser', sample?.text ?? '', {
      ...fieldDefaults,
      ...sample?.fields,
    });

    assert.equal(
      Buffer.from(output.artifact?.base64 ?? '', 'base64').toString('utf8'),
      output.text,
    );
  });

  it('rejects invalid input', async () => {
    await assert.rejects(
      result('cookie-parser', 'x'.repeat(65_537), { ...fieldDefaults, mode: 'parse' }),
      /exceeds 65,536 characters/,
    );
  });
});

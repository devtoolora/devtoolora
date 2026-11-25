import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { connectionStringTool } from '../src/catalog/webApi';
import { contentOf } from './toolContent';
import { result } from './tools.helpers';

const tool = connectionStringTool;
const defaults = Object.fromEntries(
  (tool.fields ?? []).map(({ defaultValue, id }) => [id, defaultValue ?? '']),
);

describe('connection string tool', () => {
  it('declares its fields', () => {
    assert.equal(tool.id, 'connection-string');
    assert.equal(tool.name, 'Connection String Builder & Parser');
    assert.equal(tool.category, 'Web/API');
    assert.equal(tool.inputKind, 'text');
    assert.equal(tool.outputKind, 'json');
    assert.equal(tool.sensitiveInput, true);
    assert.deepEqual(tool.inputVisibleWhen, { field: 'mode', is: ['parse'] });
    assert.equal(tool.fields?.find(({ id }) => id === 'password')?.type, 'password');

    assert.deepEqual(
      tool.fields?.map(({ defaultValue, id, label }) => [id, label, defaultValue]),
      [
        ['mode', 'Mode', 'parse'],
        ['dialect', 'Dialect', 'postgres'],
        ['host', 'Host', 'localhost'],
        ['port', 'Port', ''],
        ['username', 'User', ''],
        ['password', 'Password', ''],
        ['database', 'Database', ''],
        ['options', 'Options (key=value per line)', ''],
        ['tls', 'Require TLS', 'true'],
      ],
    );

    assert.deepEqual(tool.relatedToolIds, ['url-parse', 'secret-redactor', 'dotenv-formatter']);
    assert.ok((contentOf(tool).faq?.length ?? 0) >= 4);
    assert.equal(tool.samples?.length, 6);
  });

  it('runs every sample', async () => {
    const summaries: string[] = [];

    for (const sample of tool.samples ?? []) {
      const output = await result('connection-string', sample.text ?? '', {
        ...defaults,
        ...sample.fields,
      });

      assert.ok(output.text);
      assert.ok(output.summary);
      summaries.push(output.summary ?? '');
    }

    assert.equal(
      summaries[0],
      'PostgreSQL · db.example.com:5433 · database appdb · TLS on · password present · 1 info',
    );

    assert.match(summaries[1] ?? '', /^MongoDB · 2 hosts/);
    assert.match(summaries[5] ?? '', /^MongoDB · 1 host · TLS on/);
  });

  it('exports the artifact', async () => {
    const sample = tool.samples?.[0];
    const output = await result('connection-string', sample?.text ?? '', {
      ...defaults,
      ...sample?.fields,
    });

    assert.equal(
      Buffer.from(output.artifact?.base64 ?? '', 'base64').toString('utf8'),
      output.text,
    );
  });

  it('rejects invalid input', async () => {
    await assert.rejects(result('connection-string', 'nope', defaults), /Supported schemes/);
  });
});

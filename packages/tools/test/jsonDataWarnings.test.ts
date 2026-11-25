import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { describe, it } from 'vitest';
import { result, run } from './tools.helpers';

const big = '12345678901234567890';
const duplicate = '{"a":1,\n"a":"x"}';
const kept = 'Duplicate key "a" at line 2; only its last value is kept.';

describe('duplicate keys in sample data', () => {
  for (const id of [
    'json-schema-generator',
    'json-to-code-types',
    'json-to-typescript',
    'json-to-zod',
  ]) {
    it(`${id} warns in the summary and infers from the last value`, async () => {
      const output = await result(id, duplicate);

      assert.ok(output.summary?.endsWith(kept), output.summary);
      assert.match(output.text ?? '', /string/);
      assert.doesNotMatch(output.text ?? '', /\b(?:number|int|float|double)\b/i);
    });

    it(`${id} says nothing without a duplicate`, async () => {
      assert.doesNotMatch((await result(id, '{"a":1}')).summary ?? '', /Duplicate/);
    });
  }

  it('dotenv-converter warns in the summary', async () => {
    const output = await result('dotenv-converter', duplicate, { mode: 'json-to-env' });

    assert.equal(output.text, 'a=x\n');
    assert.ok(output.summary?.endsWith(kept), output.summary);
  });

  it('query-string-parser warns in the summary', async () => {
    const output = await result('query-string-parser', duplicate, { mode: 'stringify' });

    assert.equal(output.text, 'a=x');
    assert.ok(output.summary?.endsWith(kept), output.summary);
  });
});

describe('json-patch', () => {
  it('warns about a duplicate key in a document and rejects one in the operations', async () => {
    const applied = await result('json-patch', duplicate, {
      mode: 'apply',
      patch: '[{"op":"test","path":"/a","value":"x"}]',
    });

    assert.ok(applied.summary?.endsWith(kept), applied.summary);

    const generated = await result('json-patch', duplicate, {
      mode: 'generate',
      target: '{"a":"y",\n\n"a":"z"}',
    });

    assert.match(generated.text ?? '', /"value":"z"/);
    assert.match(generated.summary ?? '', /Original: Duplicate key "a" at line 2/);
    assert.match(generated.summary ?? '', /Target: Duplicate key "a" at line 3/);

    await assert.rejects(
      result('json-patch', '{}', {
        mode: 'apply',
        patch: '[{"op":"add","op":"remove","path":"/a"}]',
      }),
      /JSON Patch: Duplicate key "op"/,
    );
  });
});

describe('numbers out of range', () => {
  for (const id of ['json-to-typescript', 'json-to-zod', 'json-to-code-types'])
    for (const text of ['{"a":1e400}', '{"a":1e-400}'])
      it(`${id} rejects ${text}`, async () => {
        await assert.rejects(result(id, text), /range of a double/);
      });

  for (const mode of ['canonical', 'sort'])
    for (const text of ['{"a":1e400}', '{"a":1e-400}'])
      it(`json-canonicalize ${mode} rejects ${text}`, async () => {
        await assert.rejects(result('json-canonicalize', text, { mode }), /range of a double/);
      });

  it('token-preserving converters still write the literal', async () => {
    assert.equal(await run('json-to-yaml', '{"a":1e-400}'), 'a: 1e-400\n');
  });
});

describe('json-schema-validator', () => {
  const schema = '{"properties":{"a":{"type":"string"}}}';
  const checked = 'Duplicate key "a" at line 2; only its last value was checked.';

  it('never shows a bare Valid for data with a duplicate key', async () => {
    const output = await result('json-schema-validator', duplicate, { schema });

    assert.ok(output.summary?.startsWith('Valid against schema'), output.summary);
    assert.ok(output.summary?.endsWith(checked), output.summary);

    assert.match(
      output.text ?? '',
      /^Valid against schema\.\nWarning: Duplicate key "a" at line 2/,
    );

    const report = await result('json-schema-validator', duplicate, { report: 'json', schema });

    assert.deepEqual(JSON.parse(report.text ?? '').warnings, [checked]);
  });

  it('keeps a duplicate key in the schema an error', async () => {
    await assert.rejects(
      result('json-schema-validator', '{}', { schema: '{"type":"string","type":"object"}' }),
      /JSON Schema: Duplicate key "type" at line 1/,
    );
  });

  for (const id of ['json-schema-to-typescript', 'json-schema-to-zod']) {
    it(`${id} keeps a duplicate key an error`, async () => {
      await assert.rejects(
        result(id, '{"type":"string","type":"object"}'),
        /JSON Schema: Duplicate key "type" at line 1/,
      );
    });
  }

  it('keeps unsafe integers errors, because the values are compared', async () => {
    await assert.rejects(
      result('json-schema-validator', big, { schema: '{"maximum":1}' }),
      /unsafe integer/,
    );
  });
});

describe('big numbers passed through as text', () => {
  it('http-request-builder keeps the digits in the body', async () => {
    const output = await result('http-request-builder', '', {
      body: `{"id":${big}}`,
      bodyMode: 'json',
      method: 'POST',
      url: 'https://a.test/',
    });

    assert.match(output.text ?? '', new RegExp(big));
  });

  it('query-string-parser keeps the digits', async () => {
    assert.equal(
      await run('query-string-parser', `{"id":${big}}`, { mode: 'stringify' }),
      `id=${big}`,
    );
  });

  it('list-converter keeps the digits', async () => {
    assert.match(await run('list-converter', `[${big}]`, { input: 'json' }), new RegExp(big));
  });

  it('prompt-template-renderer prints the digits alone and inside an object', async () => {
    const variables = `{"id":${big},"o":{"n":${big}}}`;

    assert.equal(
      await run('prompt-template-renderer', '{{id}} {{o}}', { variables }),
      `${big} {"n":${big}}`,
    );

    await assert.rejects(
      result('prompt-template-renderer', '{{id}}', { variables: '{"id":1e-400}' }),
      /Variables: .*range of a double/,
    );
  });

  it('jwt-parse signs, decodes and verifies the exact digits', async () => {
    const secret = 'a-string-secret-at-least-256-bits-long';
    const signed = await result('jwt-parse', `{"id":${big}}`, { key: secret, mode: 'sign' });
    const token = signed.text ?? '';
    const [header, payload, signature] = token.split('.');

    assert.equal(
      signature,
      createHmac('sha256', secret).update(`${header}.${payload}`).digest('base64url'),
    );

    assert.equal(Buffer.from(payload ?? '', 'base64url').toString(), `{"id":${big}}`);

    for (const fields of [{ mode: 'decode' }, { key: secret, mode: 'verify' }] as Array<
      Record<string, string>
    >) {
      const output = await result('jwt-parse', token, fields);

      assert.match(output.text ?? '', new RegExp(`"id": ${big}`));
      assert.doesNotMatch(output.text ?? '', /rounded/);
      assert.ok(output.jsonTree?.nodes.some((node) => node.token === big));
    }
  });

  it('jwt-parse sign summary reads an exp it cannot show as a date', async () => {
    const key = 'a-string-secret-at-least-256-bits-long';

    for (const exp of [big, '1e300']) {
      const signed = await result('jwt-parse', `{"exp":${exp}}`, { key, mode: 'sign' });

      assert.match(signed.summary ?? '', /exp is not a date it can show/);
    }

    assert.match(
      (await result('jwt-parse', '{"exp":2000000000}', { key, mode: 'sign' })).summary ?? '',
      /expires 2033-05-18T03:33:20Z/,
    );
  });
});

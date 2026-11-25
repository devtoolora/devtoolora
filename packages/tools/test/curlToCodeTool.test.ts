import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import {
  curlToCodeTool,
  curlToGoTool,
  curlToJavaTool,
  curlToPhpTool,
  curlToPythonTool,
} from '../src/catalog/webApi';
import { contentOf } from './toolContent';
import { fieldsOf, result } from './tools.helpers';

const tool = curlToCodeTool;
const defaults = Object.fromEntries(
  (tool.fields ?? []).map(({ defaultValue, id }) => [id, defaultValue ?? '']),
);

describe('curl to code tool', () => {
  it('declares its fields', () => {
    assert.equal(tool.id, 'curl-to-code');
    assert.equal(tool.name, 'cURL to Code');
    assert.equal(tool.category, 'Web/API');
    assert.equal(tool.inputKind, 'text');
    assert.equal(tool.outputKind, 'text');
    assert.equal(tool.sensitiveInput, true);

    assert.deepEqual(
      tool.fields?.map(({ defaultValue, id, label }) => [id, label, defaultValue]),
      [['language', 'Language', 'python']],
    );

    assert.deepEqual(
      fieldsOf(tool)?.[0]?.options?.map(({ label }) => label),
      ['Python requests', 'Node.js fetch', 'Go net/http', 'PHP cURL', 'Java HttpClient'],
    );

    assert.deepEqual(tool.relatedToolIds, [
      'curl-to-fetch',
      'http-request-builder',
      'raw-http-request-inspector',
    ]);

    assert.ok((contentOf(tool).faq?.length ?? 0) >= 4);
    assert.equal(tool.samples?.length, 6);
  });

  it('declares the language aliases', () => {
    const aliases = [
      [curlToPythonTool, 'curl-to-python', 'cURL to Python', 'python'],
      [curlToGoTool, 'curl-to-go', 'cURL to Go', 'go'],
      [curlToPhpTool, 'curl-to-php', 'cURL to PHP', 'php'],
      [curlToJavaTool, 'curl-to-java', 'cURL to Java', 'java'],
    ] as const;

    for (const [alias, id, name, language] of aliases) {
      assert.equal(alias.id, id);
      assert.equal(alias.name, name);
      assert.equal(alias.aliasOf, 'curl-to-code');
      assert.equal(alias.fields?.[0]?.defaultValue, language);
    }
  });

  it('runs every sample', async () => {
    for (const sample of tool.samples ?? []) {
      const output = await result(tool.id, sample.text ?? '', {
        ...defaults,
        ...sample.fields,
      });

      assert.ok(output.text.length > 0, sample.label);
      assert.ok(output.summary, sample.label);
    }

    const first = tool.samples?.[0];
    const output = await result(tool.id, first?.text ?? '', { ...defaults, ...first?.fields });

    assert.equal(
      output.summary,
      'POST https://api.example.com/items · 1 header · 14 body bytes · Python requests · not sent.',
    );
  });

  it('maps each language to its result language and file name', async () => {
    const text = "curl 'https://example.com/' -H 'Authorization: Bearer x'";
    const expected = [
      ['python', 'python', 'request.py'],
      ['node', 'javascript', 'request.js'],
      ['go', 'go', 'request.go'],
      ['php', 'php', 'request.php'],
      ['java', 'java', 'Main.java'],
    ];

    for (const [language, resultLanguage, fileName] of expected) {
      const output = await result(tool.id, text, { language: language ?? '' });

      assert.equal(output.language, resultLanguage);
      assert.equal(output.artifact?.fileName, fileName);
      assert.match(output.summary ?? '', /Contains credentials; share with care\.$/);
    }
  });

  it('exports the artifact', async () => {
    const first = tool.samples?.[0];
    const output = await result(tool.id, first?.text ?? '', { ...defaults, ...first?.fields });

    assert.equal(
      Buffer.from(output.artifact?.base64 ?? '', 'base64').toString('utf8'),
      output.text,
    );
  });

  it('rejects invalid input', async () => {
    await assert.rejects(() => result(tool.id, 'wget https://x', defaults), /curl command/);
  });
});

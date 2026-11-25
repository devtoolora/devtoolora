import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { curlToFetchTool, fetchToCurlTool } from '../src/catalog/webApi';
import { contentOf } from './toolContent';

describe('request conversion', () => {
  it('provides complete guides, runnable samples and exact code exports', async () => {
    assert.equal(contentOf(curlToFetchTool).documentation?.length, 2);
    assert.equal(contentOf(curlToFetchTool).help?.split('\n\n').length, 4);
    assert.equal(curlToFetchTool.samples?.length, 11);
    assert.ok(curlToFetchTool.resultActions?.includes('save'));
    assert.equal(fetchToCurlTool.aliasOf, 'curl-to-fetch');

    for (const sample of curlToFetchTool.samples ?? []) {
      const toFetch = sample.fields?.mode === 'encode';
      const result = await curlToFetchTool.run({
        fields: sample.fields ?? {},
        text: sample.text ?? '',
      });

      assert.equal(
        Buffer.from(result.artifact?.base64 ?? '', 'base64').toString('utf8'),
        result.text,
      );

      assert.equal(result.artifact?.fileName, toFetch ? 'fetch-request.js' : 'curl-request.sh');
      assert.equal(result.language, toFetch ? 'javascript' : 'shellscript');
    }

    const fetchCall = await curlToFetchTool.run({
      fields: { mode: 'encode' },
      text: "curl -X POST 'https://api.example.com/items' -H 'Content-Type: application/json' --data-raw '{\"name\":\"Ada\"}'",
    });
    const command = await fetchToCurlTool.run({ fields: {}, text: fetchCall.text });

    assert.match(command.text, /^curl /);
    assert.match(command.text, /--data-raw '\{"name":"Ada"\}'/);
  });

  it('rejects unsupported input without creating a partial artifact', async () => {
    await assert.rejects(async () =>
      curlToFetchTool.run({
        fields: {},
        text: 'curl https://example.com --proxy http://localhost',
      }),
    );

    await assert.rejects(async () => fetchToCurlTool.run({ fields: {}, text: 'fetch(url)' }));
  });
});

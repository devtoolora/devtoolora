import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { httpRequestBuilderTool, rawHttpRequestInspectorTool } from '../src/catalog/webApi';

describe('HTTP request export', () => {
  it('counts body bytes with the correct singular or plural', async () => {
    const summary = async (body: string) =>
      (
        await httpRequestBuilderTool.run({
          fields: {
            body,
            bodyMode: 'raw',
            export: 'curl',
            method: 'POST',
            url: 'https://api.example.com/items',
          },
          text: '',
        })
      ).summary ?? '';

    assert.match(await summary('a'), / · 1 body byte · not sent\./);
    assert.match(await summary('ab'), / · 2 body bytes · not sent\./);

    assert.match(
      (
        await httpRequestBuilderTool.run({
          fields: { export: 'curl', url: 'https://api.example.com/items' },
          text: '',
        })
      ).summary ?? '',
      / · 0 body bytes · not sent\./,
    );
  });

  it('writes every repeated header value into the Python export', async () => {
    const sample = rawHttpRequestInspectorTool.samples?.find(
      (candidate) => candidate.label === 'Repeated headers',
    );

    assert.ok(sample);
    const result = await rawHttpRequestInspectorTool.run({
      fields: { ...sample.fields, export: 'python' },
      text: sample.text ?? '',
    });

    assert.match(result.text, /^ {8}"X-Trace": "first, second",$/m);

    assert.match(
      result.text,
      /^# requests sends one value per header name, so repeated X-Trace headers are combined\.$/m,
    );
  });
});

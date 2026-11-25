import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { PDFDocument } from 'pdf-lib';
import { listBrowserWorkerTools } from '@devtoolora/browser-catalog';
import { canRunTool } from '@devtoolora/core';
import { contentOf } from './toolContent';
import { result, run } from './tools.helpers';

describe('Web/API tools', () => {
  const guided = [
    'jwt-parse',
    'timestamp-convert',
    'user-agent-parser',
    'meta-tag-generator',
    'color-converter',
    'http-request-builder',
    'raw-http-request-inspector',
  ];

  it('documents every reworked tool and runs each of its six samples', async () => {
    for (const id of guided) {
      const tool = listBrowserWorkerTools().find((entry) => entry.id === id);

      assert.ok(tool, id);
      assert.ok((contentOf(tool).documentation?.length ?? 0) >= 2, id);
      assert.ok((contentOf(tool).examples?.length ?? 0) >= 6, id);
      assert.equal(contentOf(tool).help?.split('\n\n').length, 4, id);
      assert.ok((contentOf(tool).notes?.length ?? 0) >= 6, id);
      assert.equal(tool.samples?.length, 6, id);
      assert.equal(tool.autoRun, true, id);
      assert.equal(tool.freshResults, true, id);
      const fieldIds = new Set(tool.fields?.map((field) => field.id));

      for (const sample of tool.samples ?? []) {
        if (tool.fields?.length && id !== 'user-agent-parser')
          assert.deepEqual(
            Object.keys(sample.fields ?? {}).filter((key) => !fieldIds.has(key)),
            [],
            `${id}: ${sample.label}`,
          );

        const output = await result(id, sample.text, {
          ...Object.fromEntries(
            (tool.fields ?? []).map((field) => [field.id, field.defaultValue ?? '']),
          ),
          ...sample.fields,
        });

        assert.ok(output.text.length > 0, `${id}: ${sample.label}`);
      }
    }

    assert.equal(
      listBrowserWorkerTools().find((tool) => tool.id === 'timestamp-convert')?.category,
      'Date & Time',
    );

    assert.equal(
      listBrowserWorkerTools().find((tool) => tool.id === 'cron-generator')?.category,
      'Date & Time',
    );

    assert.equal(
      listBrowserWorkerTools().find((tool) => tool.id === 'color-converter')?.category,
      'CSS & Design',
    );
  });

  it('verifies the bundled JWT samples and opens the old Sign/Verify route in Verify mode', async () => {
    const tool = listBrowserWorkerTools().find((entry) => entry.id === 'jwt-parse');

    for (const sample of tool?.samples?.filter((entry) => entry.fields?.mode === 'verify') ?? []) {
      const verified = await result('jwt-parse', sample.text, sample.fields);

      assert.equal(JSON.parse(verified.text).valid, true, sample.label);

      assert.match(
        verified.summary ?? '',
        /^Valid (?:HS256|RS256|ES256) signature · expires in \d+ years\.$/,
      );
    }

    const alias = listBrowserWorkerTools().find((entry) => entry.id === 'jwt-sign-verify');

    assert.equal(alias?.fields?.find((field) => field.id === 'mode')?.defaultValue, 'verify');
    assert.equal(alias?.name, 'JWT Sign & Verify');
    const decodedOnly = await result('jwt-parse', tool?.samples?.[0]?.text, { mode: 'verify' });

    assert.equal(
      decodedOnly.summary,
      'Decoded only: enter the secret or key to verify the signature.',
    );

    const wrong = await result('jwt-parse', tool?.samples?.[0]?.text, {
      key: 'not-the-secret-but-long-enough-0123456789',
      mode: 'verify',
    });

    assert.match(wrong.summary ?? '', /^Invalid: The signature does not match this key/);
    const signed = await result('jwt-parse', '{"sub":"x"}', {
      expiresIn: '15m',
      key: 'short',
      mode: 'sign',
    });

    assert.match(
      signed.summary ?? '',
      /^Signed with HS256 · expires \d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ\. HS256 secrets should be at least 32 bytes/,
    );

    await assert.rejects(
      () => result('jwt-parse', '{}', { mode: 'sign' }),
      /Enter an HMAC secret or a private key/,
    );

    await assert.rejects(
      () => result('jwt-parse', 'x.y.z', { clockTolerance: '-5' }),
      /Clock tolerance must be a whole number from 0 to 86400/,
    );
  });

  it('converts timestamps in a chosen zone and turns several lines into a table', async () => {
    const single = await result('timestamp-convert', '2026-03-29T02:30', {
      timeZone: 'Europe/Prague',
    });
    const report = JSON.parse(single.text);

    assert.equal(report.iso, '2026-03-29T01:30:00.000Z');
    assert.equal(report.local, '2026-03-29T03:30:00+02:00');
    assert.equal(report.rfc2822, 'Sun, 29 Mar 2026 03:30:00 +0200');
    assert.equal(report.isoWeek, '2026-W13-7');

    assert.match(
      report.notes[1],
      /does not exist in Europe\/Prague because the clocks jump forward/,
    );

    assert.match(
      single.summary ?? '',
      /^ISO 8601 date-time without offset · 2026-03-29T03:30:00\+02:00 in Europe\/Prague · /,
    );

    assert.equal(
      JSON.parse(await run('timestamp-convert', '1700000000000', { timeZone: 'UTC', unit: 'auto' }))
        .detected,
      'Unix milliseconds (13 digits)',
    );

    const table = await result('timestamp-convert', '1700000000\nnot a date\n2026-01-01', {
      timeZone: 'America/New_York',
    });

    assert.deepEqual(table.jsonTable?.columns, [
      'input',
      'iso',
      'local',
      'unixSeconds',
      'unixMilliseconds',
      'relative',
      'detected',
      'error',
    ]);

    assert.equal(table.jsonTable?.rows[0]?.[2], '2023-11-14T17:13:20-05:00');
    assert.equal(table.jsonTable?.rows[2]?.[1], '2026-01-01T05:00:00.000Z');
    assert.match(table.jsonTable?.rows[1]?.[7] ?? '', /Use a Unix timestamp/);

    assert.equal(
      table.summary,
      '2 of 3 values converted · local time in America/New_York · 1 could not be read.',
    );

    assert.equal(
      JSON.parse(await run('timestamp-convert', '', { value: '0', timeZone: 'UTC' })).iso,
      '1970-01-01T00:00:00.000Z',
    );

    await assert.rejects(
      () => result('timestamp-convert', '2026-02-30', { timeZone: 'UTC' }),
      /February 2026 has 28 days/,
    );
  });

  it('converts CSS colors with alpha, gamut mapping, names and a swatch', async () => {
    const blue = await result('color-converter', 'rgb(59 130 246 / 50%)', { syntax: 'spaces' });
    const report = JSON.parse(blue.text);

    assert.equal(report.hex, '#3b82f680');
    assert.equal(report.rgb, 'rgb(59 130 246 / 0.5)');
    assert.equal(report.oklch, 'oklch(62.31% 0.188 259.81 / 0.5)');
    assert.match(blue.previewDataUri ?? '', /^data:image\/svg\+xml;base64,/);
    assert.equal(JSON.parse(await run('color-converter', 'RebeccaPurple')).name, 'rebeccapurple');
    assert.equal(JSON.parse(await run('color-converter', 'hsl(0.5turn 50% 50%)')).hex, '#40bfbf');
    const wide = await result('color-converter', 'oklch(70% 0.4 150)');

    assert.match(JSON.parse(wide.text).notes[0], /outside the sRGB gamut/);
    assert.match(wide.summary ?? '', /mapped into sRGB/);

    await assert.rejects(
      () => result('color-converter', 'currentColor'),
      /depends on where it is used/,
    );
  });

  it('writes the full meta tag set, a preview and suggestions, and waits for a title and description', async () => {
    const tool = listBrowserWorkerTools().find((entry) => entry.id === 'meta-tag-generator');

    assert.ok(tool);
    assert.equal(canRunTool(tool, '', { description: 'x', title: '' }), false);
    assert.equal(canRunTool(tool, '', { description: 'x', title: 'y' }), true);
    const output = await result('meta-tag-generator', '', {
      description: 'Q&A about "local" tools',
      image: '/og.png',
      title: 'Q&A <live>',
      twitterSite: 'example',
      url: 'https://example.com/blog/post',
    });

    assert.match(output.text, /<title>Q&amp;A &lt;live&gt;<\/title>/);

    assert.match(
      output.text,
      /<meta property="og:image" content="https:\/\/example\.com\/og\.png">/,
    );

    assert.match(output.text, /<meta name="twitter:site" content="@example">/);
    assert.equal(output.artifact?.fileName, 'meta-tags.html');

    assert.match(
      Buffer.from((output.previewDataUri ?? '').split(',')[1]!, 'base64').toString('utf8'),
      /^<svg[\s\S]*SEARCH RESULT[\s\S]*Q&amp;A &lt;live&gt;/,
    );

    assert.match(
      output.summary ?? '',
      /^Title 10\/60 · description 23\/160\. 3 suggestions: The relative image path was resolved/,
    );

    assert.match(output.summary ?? '', /Add image alt text/);

    await assert.rejects(
      () => result('meta-tag-generator', '', { description: 'd', image: 'og.png', title: 't' }),
      /og:image needs an absolute URL/,
    );
  });

  it('exports built and inspected requests as cURL, fetch, raw HTTP and Python', async () => {
    const fields = {
      body: '{"name":"Ada"}',
      bodyMode: 'json',
      headers: 'Accept: application/json',
      method: 'POST',
      url: 'https://api.example.com/items?x=1',
    };
    const raw = await result('http-request-builder', '', { ...fields, export: 'raw' });

    assert.equal(
      raw.text,
      'POST /items?x=1 HTTP/1.1\r\nHost: api.example.com\r\nAccept: application/json\r\nContent-Type: application/json\r\nContent-Length: 14\r\n\r\n{"name":"Ada"}',
    );

    assert.equal(raw.artifact?.fileName, 'request.http');
    const python = await result('http-request-builder', '', {
      ...fields,
      authMode: 'bearer',
      bearerToken: 't0k',
      export: 'python',
    });

    assert.match(
      python.text,
      /^import requests\n\nresponse = requests\.request\(\n {4}"POST",\n {4}"https:\/\/api\.example\.com\/items\?x=1",\n {4}headers=\{/,
    );

    assert.match(python.text, /"Authorization": "Bearer t0k",/);
    assert.match(python.text, /data="\{\\"name\\":\\"Ada\\"\}"\.encode\("utf-8"\),/);
    assert.match(python.summary ?? '', /Contains credentials; share with care\./);
    const all = await result('http-request-builder', '', fields);

    assert.deepEqual(
      [...all.text.matchAll(/^## (.+)$/gm)].map((match) => match[1]),
      ['cURL', 'JavaScript fetch', 'Python requests', 'Raw HTTP/1.1'],
    );

    const inspected = await result(
      'raw-http-request-inspector',
      'GET /a HTTP/1.1\nHost: api.example.com\nCookie: s=1\n\n',
      { export: 'curl' },
    );

    assert.equal(
      inspected.text,
      "curl --globoff -X 'GET' 'https://api.example.com/a' -H 'Host: api.example.com' -H 'Cookie: s=1'",
    );

    assert.match(inspected.summary ?? '', /Contains credentials/);
    const builder = listBrowserWorkerTools().find((entry) => entry.id === 'http-request-builder');

    assert.ok(builder);
    assert.equal(canRunTool(builder, '', { url: ' ' }), false);
    assert.equal(builder.fields?.find((field) => field.id === 'headers')?.sensitive, true);
  });
});

describe('documents and PDF tools', () => {
  const canonical = ['pdf-toolkit', 'pdf-page-numbers', 'pdf-metadata-editor'];
  const defaults = (id: string) =>
    Object.fromEntries(
      (listBrowserWorkerTools().find((tool) => tool.id === id)?.fields ?? []).map((field) => [
        field.id,
        field.defaultValue ?? '',
      ]),
    );
  const pdfOf = async (output: { artifact?: { base64: string } }) =>
    PDFDocument.load(Buffer.from(output.artifact?.base64 ?? '', 'base64'), {
      updateMetadata: false,
    });
  const sampleFields = (id: string, label: string) =>
    listBrowserWorkerTools()
      .find((tool) => tool.id === id)
      ?.samples?.find((sample) => sample.label === label)?.fields ?? {};

  it('documents the three PDF tools, runs every sample and keeps the old tools as aliases', async () => {
    for (const id of canonical) {
      const tool = listBrowserWorkerTools().find((entry) => entry.id === id);

      assert.ok(tool, id);
      assert.ok((contentOf(tool).documentation?.length ?? 0) >= 2, id);
      assert.ok((contentOf(tool).examples?.length ?? 0) >= 5, id);
      assert.equal(contentOf(tool).help?.split('\n\n').length, 4, id);
      assert.ok((contentOf(tool).notes?.length ?? 0) >= 5, id);
      assert.ok((tool.samples?.length ?? 0) >= 6, id);
      assert.equal(tool.autoRun, true, id);
      const fieldIds = new Set(
        tool.fields?.map((field) => field.id).flatMap((fieldId) => [fieldId, `${fieldId}Name`]),
      );

      for (const sample of tool.samples ?? []) {
        assert.deepEqual(
          Object.keys(sample.fields ?? {}).filter((key) => !fieldIds.has(key)),
          [],
          `${id}: ${sample.label}`,
        );

        const output = await result(id, '', { ...defaults(id), ...sample.fields });

        assert.ok(output.artifact, `${id}: ${sample.label}`);
        assert.ok(output.summary, `${id}: ${sample.label}`);
      }
    }

    const aliases = Object.fromEntries(
      listBrowserWorkerTools()
        .filter((tool) => tool.aliasOf?.startsWith('pdf-'))
        .map((tool) => [tool.id, tool.aliasOf]),
    );

    assert.deepEqual(aliases, {
      'pdf-delete-pages': 'pdf-toolkit',
      'pdf-diff': 'pdf-compare',
      'pdf-extract-pages': 'pdf-toolkit',
      'pdf-header-footer': 'pdf-page-numbers',
      'pdf-page-counter': 'pdf-toolkit',
      'pdf-watermark': 'pdf-page-numbers',
    });

    assert.equal(defaults('pdf-page-counter').mode, 'info');
    assert.equal(defaults('pdf-delete-pages').mode, 'delete');
    assert.equal(defaults('pdf-watermark').watermark, 'DRAFT');

    assert.equal(
      canRunTool(
        listBrowserWorkerTools().find((tool) => tool.id === 'pdf-toolkit'),
        '',
        defaults('pdf-toolkit'),
      ),
      false,
    );

    assert.equal(
      canRunTool(
        listBrowserWorkerTools().find((tool) => tool.id === 'pdf-delete-pages'),
        '',
        {
          ...defaults('pdf-delete-pages'),
          pdfs: '[{"name":"a.pdf","data":"data:application/pdf;base64,JVBERg=="}]',
        },
      ),
      false,
    );
  });

  it('edits pages with exact results and readable summaries', async () => {
    const merge = await result('pdf-toolkit', '', {
      ...defaults('pdf-toolkit'),
      ...sampleFields('pdf-toolkit', 'Merge a report and its appendix'),
    });

    assert.equal((await pdfOf(merge)).getPageCount(), 6);
    assert.equal((await pdfOf(merge)).getTitle(), 'Quarterly report');

    assert.match(
      merge.summary ?? '',
      /^Merged 2 files in the order shown · [\d.]+ KiB → [\d.]+ KiB\.$/,
    );

    const info = await result('pdf-toolkit', '', {
      ...defaults('pdf-toolkit'),
      ...sampleFields('pdf-toolkit', 'Page count, size and details'),
    });

    assert.deepEqual(
      info.jsonTable?.rows.map((row) => row.slice(0, 4)),
      [
        ['quarterly-report.pdf', '4', 'A4 portrait (210 × 297 mm)', '1.7'],
        ['appendix.pdf', '2', 'Letter portrait (216 × 279 mm)', '1.7'],
      ],
    );

    assert.equal(info.summary, '2 files · 6 pages in total.');
    const extracted = await result('pdf-toolkit', '', {
      ...defaults('pdf-toolkit'),
      ...sampleFields('pdf-toolkit', 'Extract the first and last page'),
    });

    assert.equal((await pdfOf(extracted)).getPageCount(), 2);
    assert.equal(extracted.artifact?.fileName, 'quarterly-report-extract.pdf');
    assert.match(extracted.summary ?? '', /^Extracted pages 1, 4 of 4 · /);
    const reordered = await result('pdf-toolkit', '', {
      ...defaults('pdf-toolkit'),
      ...sampleFields('pdf-toolkit', 'Move the last page to the front'),
      order: '4, 1',
    });

    assert.match(reordered.summary ?? '', /New order 4, 1; dropped pages 2-3 · /);
    const rotated = await result('pdf-toolkit', '', {
      ...defaults('pdf-toolkit'),
      ...sampleFields('pdf-toolkit', 'Rotate even pages 90° right'),
    });

    assert.deepEqual(
      (await pdfOf(rotated)).getPages().map((page) => page.getRotation().angle),
      [0, 90, 0, 90],
    );

    for (const [angle, label] of [
      ['180', '180°'],
      ['270', '90° left'],
    ] as const) {
      const turned = await result('pdf-toolkit', '', {
        ...defaults('pdf-toolkit'),
        ...sampleFields('pdf-toolkit', 'Rotate even pages 90° right'),
        angle,
      });

      assert.match(turned.summary ?? '', new RegExp(`^Rotated .* ${label}`));
    }

    const split = await result('pdf-toolkit', '', {
      ...defaults('pdf-toolkit'),
      ...sampleFields('pdf-toolkit', 'Split into 2-page files'),
    });

    assert.equal(split.artifact?.fileName, 'quarterly-report-split.zip');

    assert.equal(
      split.text,
      split.text
        .split('\n')
        .filter((line) => /^quarterly-report-p\d-\d\.pdf · /.test(line))
        .join('\n'),
    );

    await assert.rejects(
      result('pdf-toolkit', '', {
        ...defaults('pdf-toolkit'),
        pdfs: sampleFields('pdf-toolkit', 'Delete pages 2-3').pdfs!,
      }),
      /at least two PDF files/,
    );

    await assert.rejects(
      result('pdf-toolkit', '', {
        ...defaults('pdf-toolkit'),
        ...sampleFields('pdf-toolkit', 'Delete pages 2-3'),
        pages: '7',
      }),
      /Page 7 does not exist; this PDF has 4 pages/,
    );

    const deleted = await result('pdf-delete-pages', '', {
      pages: '2',
      pdfs: JSON.parse(sampleFields('pdf-toolkit', 'Delete pages 2-3').pdfs ?? '[]')[0].data,
    });

    assert.equal((await pdfOf(deleted)).getPageCount(), 3);
  });

  it('stamps pages and edits metadata', async () => {
    const stamped = await result('pdf-page-numbers', '', {
      ...defaults('pdf-page-numbers'),
      ...sampleFields('pdf-page-numbers', 'Number from page 2, skip the cover'),
    });

    assert.equal(stamped.artifact?.fileName, 'quarterly-report-stamped.pdf');
    assert.match(stamped.summary ?? '', /^Added footer to pages 2-4 of 4 · /);
    const report = sampleFields('pdf-page-numbers', 'Page X of Y footer');

    await assert.rejects(
      result('pdf-page-numbers', '', {
        ...defaults('pdf-page-numbers'),
        ...report,
        footer: 'Page {page}',
      }),
      /\{page\} is not a placeholder/,
    );

    const view = await result('pdf-metadata-editor', '', {
      ...defaults('pdf-metadata-editor'),
      ...sampleFields('pdf-metadata-editor', 'View metadata and details'),
    });

    assert.equal(view.summary, '“Quarterly report” · 4 pages · PDF 1.7 · not encrypted.');
    const edited = await result('pdf-metadata-editor', '', {
      ...defaults('pdf-metadata-editor'),
      ...sampleFields('pdf-metadata-editor', 'Keep only a new title'),
    });

    assert.deepEqual(JSON.parse(edited.text).changed, ['author', 'creator', 'title']);
    assert.equal((await pdfOf(edited)).getTitle(), 'Public summary');
    assert.equal((await pdfOf(edited)).getAuthor(), undefined);
    const removed = await result('pdf-metadata-editor', '', {
      ...defaults('pdf-metadata-editor'),
      ...sampleFields('pdf-metadata-editor', 'Remove all metadata before sharing'),
    });

    assert.equal(removed.artifact?.fileName, 'quarterly-report-clean.pdf');
    assert.deepEqual(Object.values(JSON.parse(removed.text).after).filter(Boolean), []);
  });
});

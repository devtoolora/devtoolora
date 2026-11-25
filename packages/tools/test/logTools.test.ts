import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { logsDiagnosticTools } from '../src/catalog/logsDiagnostics';
import {
  cleanStackTrace,
  filterLogLines,
  inspectJsonLines,
  redactLogText,
} from '../../functions/src/logs';
import { contentOf } from './toolContent';

describe('log tools', () => {
  it('handles escapes, strict flags, original frame order and bounded inputs', () => {
    const redacted = redactLogText('{"token":"demo\\\"secret","user":"ada"}').text;

    assert.equal(redacted, '{"token":"<redacted>","user":"ada"}');
    assert.equal(filterLogLines('WARN demo\rINFO demo', 'WARN', '', ''), 'WARN demo');
    for (const flags of ['g', 'y', 'ii', 'x', 'uv'])
      assert.throws(() => filterLogLines('demo', 'demo', '', flags));
    const trace = cleanStackTrace(
      'Error: demo\n at a (/a.ts:1:2)\n File "app.py", line 2, in run\n at b (/b.ts:3:4)',
    );

    assert.ok(trace.indexOf('File "app.py"') < trace.indexOf('at b'));
    assert.match(inspectJsonLines('{"id":1}\r\rnot json'), /Line 3: Invalid JSON/);
    assert.ok(!inspectJsonLines('{"secret":"unfinished}').includes('unfinished'));
    assert.throws(() => inspectJsonLines('x'.repeat(1048577)), /exceeds/);
  });

  it('summarizes the redaction count with the correct plural', async () => {
    const redactor = logsDiagnosticTools.find((tool) => tool.id === 'raw-log-redactor');

    assert.match(
      (await redactor?.run({ fields: {}, text: 'github_token=demo' }))?.summary ?? '',
      /^1 redaction substitution · /,
    );

    assert.match(
      (await redactor?.run({ fields: {}, text: 'token=a secret=b' }))?.summary ?? '',
      /^2 redaction substitutions · /,
    );

    assert.match(
      (await redactor?.run({ fields: {}, text: 'tokenizer=on' }))?.summary ?? '',
      /^0 redaction substitutions · /,
    );
  });

  it('provides four full guides, six examples each and byte-identical downloadable samples', async () => {
    for (const tool of logsDiagnosticTools) {
      assert.equal(contentOf(tool).documentation?.length, 2);
      assert.ok((tool.samples?.length ?? 0) >= 6);
      assert.ok((contentOf(tool).examples?.length ?? 0) >= 6);

      for (const sample of tool.samples ?? []) {
        const result = await tool.run({ fields: sample.fields ?? {}, text: sample.text ?? '' });

        assert.equal(
          Buffer.from(result.artifact?.base64 ?? '', 'base64').toString('utf8'),
          result.text,
        );
      }
    }
  });

  it('names the HAR total for what it is', async () => {
    const viewer = logsDiagnosticTools.find((tool) => tool.id === 'har-viewer');
    const har = JSON.stringify({
      log: {
        entries: [{ response: { bodySize: 100, content: { size: 1000 }, status: 200 } }],
      },
    });
    const report = await viewer?.run({ fields: { view: 'summary' }, text: har });

    assert.match(report?.text ?? '', /Content size: 1\.0 kB/);
    assert.doesNotMatch(report?.text ?? '', /Transferred/);
  });

  it('counts filtered lines without the empty text after a final newline', async () => {
    const filter = logsDiagnosticTools.find((tool) => tool.id === 'log-filter');
    const summary = async (text: string): Promise<string> =>
      (await filter?.run({ fields: { excludePattern: '^a$' }, text }))?.summary ?? '';

    assert.match(await summary('a\nb\n'), /^Matched 1 log line /);
    assert.match(await summary('b\nc'), /^Matched 2 log lines /);
    assert.match(await summary('a'), /^Matched 0 log lines /);
  });
});

describe('raw log redactor warnings', () => {
  it('shows an open-ended mask in the summary', async () => {
    const redactor = logsDiagnosticTools.find((tool) => tool.id === 'raw-log-redactor');
    const result = await redactor?.run({ fields: {}, text: 'ok\npassword="abc\nmore' });

    assert.equal(result?.text, 'ok\npassword=<redacted>');
    assert.match(result?.summary ?? '', /A quote, bracket or private key block on line 2 never/);
  });
});

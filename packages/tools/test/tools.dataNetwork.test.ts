import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { dataTools, devUtilityTools, mathTools, networkTools } from '@devtoolora/tools';
import { ToolError } from '@devtoolora/core';
import { contentOf } from './toolContent';
import { result, run } from './tools.helpers';

describe('network, math, measurement and data tools', () => {
  it('provides exact Number Formatter samples, guides, consistent precision and saved bytes', async () => {
    const tool = dataTools.find((entry) => entry.id === 'number-formatter');

    assert.ok(tool);
    assert.equal(contentOf(tool).documentation?.length, 2);
    assert.equal(contentOf(tool).help?.split('\n\n').length, 4);
    assert.equal(tool.samples?.length, 6);
    assert.equal(contentOf(tool).examples?.length, 6);
    assert.ok((contentOf(tool).notes?.length ?? 0) >= 6);

    for (const sample of tool.samples ?? []) {
      assert.deepEqual(Object.keys(sample.fields ?? {}).sort(), [
        'currency',
        'decimals',
        'grouping',
        'locale',
        'mode',
        'precision',
        'report',
      ]);

      const output = await tool.run({ fields: sample.fields ?? {}, text: sample.text ?? '' });

      assert.ok(output.artifact);
      assert.equal(Buffer.from(output.artifact.base64, 'base64').toString('utf8'), output.text);

      assert.equal(
        output.artifact.fileName,
        sample.fields?.report === 'json' ? 'number-format-report.json' : 'formatted-number.txt',
      );
    }

    assert.equal(
      await run('number-formatter', '9007199254740993.125', { decimals: '3', grouping: 'false' }),
      '9007199254740993.125',
    );

    assert.equal(
      await run('number-formatter', '0.856', { decimals: '1', mode: 'percent' }),
      '85.6%',
    );

    const invalidFields: Array<Record<string, string>> = [
      { decimals: '1.5' },
      { decimals: '21' },
      { decimals: '' },
      { grouping: 'yes' },
      { mode: 'unknown' },
      { precision: 'unknown' },
      { report: 'unknown' },
    ];

    for (const fields of invalidFields) {
      await assert.rejects(() => run('number-formatter', '1', fields), ToolError);
    }

    await assert.rejects(() => run('number-formatter', '1,5'), ToolError);
  });

  it('explains IBAN checks and saves diagnostic reports or validated identifiers', async () => {
    const tool = dataTools.find((entry) => entry.id === 'iban-validator');

    assert.ok(tool);
    assert.equal(contentOf(tool).documentation?.length, 2);
    assert.equal(contentOf(tool).help?.split('\n\n').length, 4);
    assert.equal(tool.samples?.length, 6);
    assert.equal(contentOf(tool).examples?.length, 6);
    assert.ok((contentOf(tool).notes?.length ?? 0) >= 6);

    for (const sample of tool.samples ?? []) {
      assert.deepEqual(Object.keys(sample.fields ?? {}), ['report']);
      const output = await tool.run({ fields: sample.fields ?? {}, text: sample.text ?? '' });

      assert.ok(output.artifact);
      assert.equal(Buffer.from(output.artifact.base64, 'base64').toString('utf8'), output.text);

      assert.equal(
        output.artifact.fileName,
        sample.fields?.report === 'json' ? 'iban-report.json' : 'iban.txt',
      );
    }

    const invalid = await result('iban-validator', 'GB83WEST12345698765432');

    assert.equal(JSON.parse(invalid.text).valid, false);
    assert.match(invalid.summary ?? '', /Invalid IBAN/);

    assert.equal(
      await run('iban-validator', 'CZ65 0800 0000 1920 0014 5399', { report: 'electronic' }),
      'CZ6508000000192000145399',
    );

    assert.equal(
      await run('iban-validator', 'CZ6508000000192000145399', { report: 'print' }),
      'CZ65 0800 0000 1920 0014 5399',
    );

    for (const report of ['electronic', 'print'])
      await assert.rejects(
        () => run('iban-validator', 'GB83WEST12345698765432', { report }),
        ToolError,
      );

    await assert.rejects(
      () => run('iban-validator', 'GB82WEST12345698765432', { report: 'unknown' }),
      ToolError,
    );
  });

  it('provides Phone Formatter guides, fully reset samples and exact output artifacts', async () => {
    const tool = dataTools.find((entry) => entry.id === 'phone-formatter');

    assert.ok(tool);
    assert.equal(contentOf(tool).documentation?.length, 2);
    assert.equal(contentOf(tool).help?.split('\n\n').length, 4);
    assert.equal(tool.samples?.length, 6);
    assert.equal(contentOf(tool).examples?.length, 6);
    assert.ok((contentOf(tool).notes?.length ?? 0) >= 6);
    const countryField = tool.fields?.find((field) => field.id === 'countryCode');

    assert.ok(countryField?.type === 'select');
    assert.ok(countryField.options.length > 200);

    for (const sample of tool.samples ?? []) {
      assert.deepEqual(Object.keys(sample.fields ?? {}).sort(), ['countryCode', 'report']);
      const output = await tool.run({ fields: sample.fields ?? {}, text: sample.text ?? '' });

      assert.ok(output.artifact);
      assert.equal(Buffer.from(output.artifact.base64, 'base64').toString('utf8'), output.text);

      assert.equal(
        output.artifact.fileName,
        sample.fields?.report === 'json' ? 'phone-report.json' : 'phone-number.txt',
      );
    }

    assert.equal(
      await run('phone-formatter', '020 7946 0018', { countryCode: 'GB', report: 'e164' }),
      '+442079460018',
    );

    assert.equal(
      await run('phone-formatter', '+14155550134 ext. 123', { report: 'uri' }),
      'tel:+14155550134;ext=123',
    );

    assert.equal(
      await run('phone-formatter', '+14155550134', { report: 'national' }),
      '(415) 555-0134',
    );

    await assert.rejects(() => run('phone-formatter', 'garbage 123'), ToolError);

    await assert.rejects(
      () => run('phone-formatter', '+14155550134', { report: 'unknown' }),
      ToolError,
    );
  });

  it('keeps all eleven Network tools together with complete guides and exact saved samples', async () => {
    assert.equal(networkTools.filter((tool) => !tool.aliasOf).length, 11);
    assert.ok(!devUtilityTools.some((tool) => tool.id === 'ipv4-subnet'));

    for (const tool of networkTools.filter((entry) => !entry.id.startsWith('wireguard-'))) {
      assert.equal(tool.category, 'Network');
      assert.equal(contentOf(tool).documentation?.length, 2);
      assert.equal(contentOf(tool).examples?.length, 6);
      assert.equal(contentOf(tool).help?.split('\n\n').length, 4);
      assert.ok((contentOf(tool).notes?.length ?? 0) >= 6);
      assert.deepEqual(tool.resultActions, ['copy', 'replace', 'insert', 'scratch', 'save']);
      assert.equal(tool.samples?.length, 6);

      for (const sample of tool.samples ?? []) {
        const output = await tool.run({ fields: sample.fields ?? {}, text: sample.text ?? '' });

        assert.ok(output.artifact);
        assert.equal(Buffer.from(output.artifact.base64, 'base64').toString('utf8'), output.text);
        if (output.language === 'json') assert.ok(JSON.parse(output.text));
      }
    }

    assert.equal(
      JSON.parse(await run('ipv4-converter', '0xC0A8010A', { format: 'hex' })).dotted,
      '192.168.1.10',
    );

    const subnet = JSON.parse(await run('ipv4-subnet', '203.0.113.11/31'));

    assert.equal(subnet.broadcastAddress, null);
    assert.equal(subnet.hostCount, 2);
    assert.equal(subnet.cidr, '203.0.113.10/31');
    const plan = JSON.parse(await run('ipv6-ula', '', { report: 'json' }));

    assert.equal(plan.exampleHost, plan.prefix.replace('::/48', ':1::1'));
    assert.equal(plan.globalId.length, 10);

    assert.match(
      await run('mac-generator', '', { count: '3', format: 'dotted' }),
      /^(?:[0-9a-f]{4}\.){2}[0-9a-f]{4}\n/,
    );

    for (const count of ['0', '101', '1.5', '1e2', '-1'])
      await assert.rejects(() => run('mac-generator', '', { count }), ToolError);
    await assert.rejects(() => run('mac-generator', '', { format: 'unknown' }), ToolError);
    await assert.rejects(() => run('ipv4-converter', '1.2.3.4', { format: 'unknown' }), ToolError);
    await assert.rejects(() => run('ipv6-ula', '', { report: 'unknown' }), ToolError);

    assert.ok(
      networkTools
        .filter((tool) => tool.inputKind === 'none' && tool.id !== 'bandwidth-calculator')
        .every((tool) => !tool.autoRun),
    );
  });

  it('handles network helpers', async () => {
    assert.equal(JSON.parse(await run('ipv4-converter', '192.168.1.10')).integer, 3232235786);

    assert.equal(
      await run('ipv4-range', '192.168.1.0/30'),
      '192.168.1.0\n192.168.1.1\n192.168.1.2\n192.168.1.3',
    );

    assert.match(await run('mac-generator', '', { count: '1' }), /^[0-9a-f]{2}(:[0-9a-f]{2}){5}$/);
    assert.match(await run('ipv6-ula'), /^fd[0-9a-f:]+::\/48$/);
  });

  it('provides exact base conversion, complete examples and matching saved output', async () => {
    const tool = mathTools.find((entry) => entry.id === 'base-converter');

    assert.ok(tool);
    assert.equal(contentOf(tool).documentation?.length, 2);
    assert.equal(tool.samples?.length, 6);
    assert.equal(contentOf(tool).examples?.length, 6);
    assert.equal(contentOf(tool).help?.split('\n\n').length, 4);
    assert.deepEqual(tool.resultActions, ['copy', 'replace', 'insert', 'scratch', 'save']);

    for (const sample of tool.samples ?? []) {
      assert.deepEqual(Object.keys(sample.fields ?? {}).sort(), ['from', 'report', 'to', 'value']);
      const result = await tool.run({ fields: sample.fields ?? {}, text: sample.text ?? '' });

      assert.ok(result.artifact);
      assert.equal(Buffer.from(result.artifact.base64, 'base64').toString('utf8'), result.text);

      assert.equal(
        result.artifact.fileName,
        sample.fields?.report === 'json' ? 'base-conversion.json' : 'base-conversion.txt',
      );
    }

    const report = JSON.parse(
      await run('base-converter', '', {
        from: '10',
        report: 'json',
        to: '16',
        value: '18446744073709551615',
      }),
    );

    assert.equal(report.output, 'ffffffffffffffff');
    assert.equal(report.decimal, '18446744073709551615');
    assert.equal(await run('base-converter', 'ff'), '255');
  });

  it('rejects invalid base conversion fields and partial numbers in the shared worker', async () => {
    const cases: Record<string, string>[] = [
      { from: '2.5' },
      { from: '1' },
      { from: '37' },
      { to: '2e1' },
      { to: 'nope' },
      { report: 'unknown' },
      { from: '2', value: '102' },
      { from: '16', value: 'ffjunk' },
      { from: '10', value: '0xff' },
    ];

    for (const fields of cases) {
      await assert.rejects(
        () => run('base-converter', '', { from: '16', to: '10', value: 'ff', ...fields }),
        ToolError,
      );
    }
  });

  it('handles math, measurement, and data helpers', async () => {
    assert.equal(await run('math-evaluator', '(12 + 8) * 3 / 4'), '15');
    assert.equal(await run('math-evaluator', '-2 + 3 * (4 + 1)'), '13');
    await assert.rejects(() => run('math-evaluator', 'process.exit()'), ToolError);
    assert.equal(await run('base-converter', '', { value: 'ff', from: '16', to: '10' }), '255');

    assert.equal(
      JSON.parse(
        await run('percentage-calculator', '', { mode: 'percent-of', percent: '25', value: '200' }),
      ).result,
      50,
    );

    assert.equal(
      JSON.parse(
        await run('percentage-calculator', '', { mode: 'what-percent', part: '25', total: '200' }),
      ).result,
      12.5,
    );

    const percentChange = JSON.parse(
      await run('percentage-calculator', '', {
        mode: 'percent-change',
        oldValue: '200',
        newValue: '250',
      }),
    );

    assert.equal(percentChange.result, 25);
    assert.equal(percentChange.direction, 'increase');

    assert.deepEqual(
      JSON.parse(
        await run('percentage-calculator', '', {
          mode: 'add-percent',
          value: '200',
          percent: '15',
        }),
      ).result,
      {
        increased: 230,
        decreased: 170,
      },
    );

    await assert.rejects(
      () => run('percentage-calculator', '', { mode: 'what-percent', part: '25', total: '0' }),
      ToolError,
    );

    await assert.rejects(
      () =>
        run('percentage-calculator', '', {
          mode: 'percent-change',
          oldValue: '0',
          newValue: '250',
        }),
      ToolError,
    );

    await assert.rejects(
      () => run('percentage-calculator', '', { mode: 'percent-of', percent: 'nope', value: '200' }),
      ToolError,
    );

    assert.equal(
      Math.round(
        JSON.parse(await run('temperature-converter', '', { value: '32', unit: 'f' })).celsius,
      ),
      0,
    );

    assert.equal(
      JSON.parse(await run('iban-validator', 'GB82 WEST 1234 5698 7654 32')).valid,
      true,
    );

    assert.equal(
      JSON.parse(await run('phone-formatter', '(415) 555-0134', { countryCode: '1' })).e164,
      '+14155550134',
    );
  });
});

describe('errors and larger inputs', () => {
  it('throws ToolError for invalid JSON and required fields', async () => {
    await assert.rejects(() => run('json-format', '{'), ToolError);
    await assert.rejects(() => run('hmac', 'hello'), ToolError);

    await assert.rejects(
      () =>
        run('random-token', '', {
          mode: 'custom',
          lowercase: 'false',
          uppercase: 'false',
          numbers: 'false',
          symbols: 'false',
        }),
      /Enable at least one character group/,
    );

    await assert.rejects(
      () => run('cron-explain', '0 0 0 * *'),
      /Day of month value 0 is outside 1-31/,
    );

    await assert.rejects(() => run('cron-explain', '* * *'), /must have five fields/);
  });

  it('handles larger JSON payloads', async () => {
    const payload = JSON.stringify({
      items: Array.from({ length: 1000 }, (_, index) => ({ index })),
    });
    const formatted = await run('json-format', payload);

    assert.match(formatted, /"index": 999/);
  });
});

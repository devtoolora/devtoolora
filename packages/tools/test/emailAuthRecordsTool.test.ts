import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { dmarcRecordTool, emailAuthRecordsTool, spfRecordTool } from '../src/catalog/webApi';
import { contentOf } from './toolContent';
import { result } from './tools.helpers';

const fieldDefaults = Object.fromEntries(
  (emailAuthRecordsTool.fields ?? []).map(({ defaultValue, id }) => [id, defaultValue ?? '']),
);

describe('email auth records tool', () => {
  it('declares its fields', () => {
    assert.equal(emailAuthRecordsTool.id, 'email-auth-records');
    assert.equal(emailAuthRecordsTool.name, 'SPF, DKIM & DMARC Record Builder & Parser');
    assert.equal(emailAuthRecordsTool.category, 'Web/API');
    assert.equal(emailAuthRecordsTool.inputKind, 'text');
    assert.equal(emailAuthRecordsTool.outputKind, 'text');

    assert.deepEqual(
      emailAuthRecordsTool.fields?.map(({ defaultValue, id, label }) => [id, label, defaultValue]),
      [
        ['mode', 'Mode', 'parse'],
        ['ip4', 'IPv4 addresses or CIDRs', ''],
        ['ip6', 'IPv6 addresses or CIDRs', ''],
        ['includes', 'Include domains', ''],
        ['a', 'Allow the domain A record', 'false'],
        ['mx', 'Allow the MX hosts', 'true'],
        ['all', 'All qualifier', '-all'],
        ['redirect', 'Redirect domain', ''],
        ['policy', 'Policy', 'reject'],
        ['subdomainPolicy', 'Subdomain policy', ''],
        ['rua', 'Aggregate report addresses', ''],
        ['ruf', 'Forensic report addresses', ''],
        ['pct', 'Percentage', '100'],
        ['adkim', 'DKIM alignment', 'r'],
        ['aspf', 'SPF alignment', 'r'],
        ['fo', 'Failure reporting', '0'],
        ['selector', 'Selector', ''],
        ['domain', 'Domain', ''],
        ['keyType', 'Key type', 'rsa'],
        ['testing', 'Testing mode (t=y)', 'false'],
      ],
    );

    assert.deepEqual(emailAuthRecordsTool.relatedToolIds, [
      'email-header-analyzer',
      'email-normalizer',
      'certificate-inspector',
    ]);

    assert.ok((contentOf(emailAuthRecordsTool).faq?.length ?? 0) >= 4);
    assert.equal(emailAuthRecordsTool.samples?.length, 6);
  });

  it('declares the aliases', () => {
    assert.deepEqual(
      [spfRecordTool, dmarcRecordTool].map((tool) => [
        tool.id,
        tool.name,
        tool.aliasOf,
        tool.fields?.find((field) => field.id === 'mode')?.defaultValue,
      ]),
      [
        ['spf-record', 'SPF Record Builder', 'email-auth-records', 'spf'],
        ['dmarc-record', 'DMARC Record Builder', 'email-auth-records', 'dmarc'],
      ],
    );
  });

  it('runs every sample', async () => {
    const summaries: string[] = [];

    for (const sample of emailAuthRecordsTool.samples ?? []) {
      const output = await result('email-auth-records', sample.text ?? '', {
        ...fieldDefaults,
        ...sample.fields,
      });

      assert.ok(output.text);
      assert.ok(output.summary);
      summaries.push(output.summary ?? '');
    }

    assert.equal(summaries[0], 'SPF · 4 terms · 2 of 10 lookups · no findings');
    assert.match(summaries[3] ?? '', /^SPF record · 2 of 10 lookups/);
    assert.match(summaries[4] ?? '', /^DMARC record · p=/);
    assert.match(summaries[5] ?? '', /^DKIM record · rsa 2,048-bit · sel1\._domainkey\./);
  });

  it('exports the artifact', async () => {
    const sample = emailAuthRecordsTool.samples?.[0];
    const output = await result('email-auth-records', sample?.text ?? '', {
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
      result('email-auth-records', 'hello', { ...fieldDefaults, mode: 'parse' }),
      /v=spf1, v=DMARC1 or v=DKIM1/,
    );
  });
});

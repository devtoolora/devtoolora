import { ToolDefinition, ToolError, ToolField, ToolResult } from '@devtoolora/core';
import * as webFunctions from '@devtoolora/functions/web';
import type { Finding } from '@devtoolora/functions/web';
import { withToolError } from '../../../adapters/errors';
import { browserSafeCapabilities, identityOutput } from '../shared';

// A 2048-bit RSA public key (SPKI, base64) generated once for the DKIM samples.
const sampleDkimKey =
  'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAvJbhvQ/ybOfkWC/HocgcpV+cZ+b31UUhBwSzn2Ay3VXiIRzQjvRXQqbp8u87ZH09izQufBhu9Y5DcJEUr6JinbKZ8pn6lcvCfHRW1GOzgjEl2ek0SIKO48rzO85dUqj98T9gyNJ6oW+opNYSWGRpF3MOIfnEkdGtfv8RMx9dNj8mq/DsfW9f76iwHCGUftMPU2jNVnu4nmTJUqapFtbdMNSgQRCihaOJC1D8toefP3dCIitCivLxq2od2kUIe4l/ChEDnq+1Pw7cax4GCoR1dnL+FlB/wTILWq8Cj8AKh3gGMAa1lh1h29O0jx2uzlDb98Hk5rX3YaWyLuzHwFH/iwIDAQAB';
const samplePem = `-----BEGIN PUBLIC KEY-----\n${sampleDkimKey.match(/.{1,64}/g)?.join('\n')}\n-----END PUBLIC KEY-----`;

const inMode = (...modes: string[]) => ({ field: 'mode', is: modes });

function field(
  id: string,
  label: string,
  defaultValue: string,
  modes: string[],
  extra: Partial<ToolField> = {},
): ToolField {
  return {
    defaultValue,
    id,
    label,
    type: 'text',
    visibleWhen: inMode(...modes),
    ...extra,
  } as ToolField;
}

const lines: Partial<ToolField> = { rows: 3, type: 'textarea' };
const checkbox: Partial<ToolField> = { type: 'checkbox' };
const allowed = (values: string[], labelled: string[][] = []): Partial<ToolField> => ({
  options: [
    ...labelled.map(([value = '', label = '']) => ({ label, value })),
    ...values.map((value) => ({ label: value, value })),
  ],
  type: 'select',
});
const policies = ['none', 'quarantine', 'reject'];

export const emailAuthRecordsTool: ToolDefinition = {
  id: 'email-auth-records',
  name: 'SPF, DKIM & DMARC Record Builder & Parser',
  category: 'Web/API',
  description:
    'Explain pasted SPF, DMARC and DKIM TXT records with findings, or build SPF, DMARC and DKIM records, including the DKIM zone-file form. Nothing is looked up in DNS.',
  samples: [
    {
      fields: { mode: 'parse' },
      label: 'Parse an SPF record',
      text: 'v=spf1 include:_spf.google.com ip4:203.0.113.0/24 mx -all',
    },
    {
      fields: { mode: 'parse' },
      label: 'Parse a DMARC record from a zone file',
      text: '_dmarc.example.com. 3600 IN TXT "v=DMARC1; p=reject; " "rua=mailto:dmarc@example.com; pct=100; adkim=s"',
    },
    {
      fields: { mode: 'parse' },
      label: 'Parse a DKIM record',
      text: `v=DKIM1; k=rsa; p=${sampleDkimKey}`,
    },
    {
      fields: { all: '-all', includes: '_spf.google.com', mode: 'spf', mx: 'true' },
      label: 'Build SPF for Google Workspace',
      text: '',
    },
    {
      fields: { mode: 'dmarc', pct: '100', policy: 'quarantine', rua: 'dmarc@example.com' },
      label: 'Build DMARC with reports',
      text: '',
    },
    {
      fields: { domain: 'example.com', keyType: 'rsa', mode: 'dkim', selector: 'sel1' },
      label: 'Build DKIM from a PEM key',
      text: samplePem,
    },
  ],
  inputKind: 'text',
  inputPresentation: {
    byMode: { dkim: { label: 'Public key (SPKI PEM or base64)' } },
    label: 'TXT record',
  },
  inputVisibleWhen: { field: 'mode', is: ['parse', 'dkim'] },
  outputKind: 'text',
  supportsSelection: true,
  capabilities: browserSafeCapabilities,
  freshResults: true,
  fields: [
    {
      defaultValue: 'parse',
      id: 'mode',
      label: 'Mode',
      options: [
        { label: 'Parse', value: 'parse' },
        { label: 'Build SPF', value: 'spf' },
        { label: 'Build DMARC', value: 'dmarc' },
        { label: 'Build DKIM', value: 'dkim' },
      ],
      presentation: 'segmented',
      type: 'select',
    },
    field('ip4', 'IPv4 addresses or CIDRs', '', ['spf'], lines),
    field('ip6', 'IPv6 addresses or CIDRs', '', ['spf'], lines),
    field('includes', 'Include domains', '', ['spf'], lines),
    field('a', 'Allow the domain A record', 'false', ['spf'], checkbox),
    field('mx', 'Allow the MX hosts', 'true', ['spf'], checkbox),
    field('all', 'All qualifier', '-all', ['spf'], allowed(['-all', '~all', '?all'])),
    field('redirect', 'Redirect domain', '', ['spf']),
    field('policy', 'Policy', 'reject', ['dmarc'], allowed(policies)),
    field(
      'subdomainPolicy',
      'Subdomain policy',
      '',
      ['dmarc'],
      allowed(policies, [['', 'Same as policy']]),
    ),
    field('rua', 'Aggregate report addresses', '', ['dmarc'], lines),
    field('ruf', 'Forensic report addresses', '', ['dmarc'], lines),
    field('pct', 'Percentage', '100', ['dmarc']),
    field('adkim', 'DKIM alignment', 'r', ['dmarc'], allowed(['r', 's'])),
    field('aspf', 'SPF alignment', 'r', ['dmarc'], allowed(['r', 's'])),
    field('fo', 'Failure reporting', '0', ['dmarc'], allowed(['0', '1', 'd', 's'])),
    field('selector', 'Selector', '', ['dkim']),
    field('domain', 'Domain', '', ['dkim']),
    field('keyType', 'Key type', 'rsa', ['dkim'], allowed(['rsa', 'ed25519'])),
    field('testing', 'Testing mode (t=y)', 'false', ['dkim'], checkbox),
  ],
  keywords: [
    'spf',
    'spf record',
    'dkim',
    'dkim record',
    'dmarc',
    'dmarc record',
    'email authentication',
    'txt record',
    'dns',
    'domainkey',
  ],
  relatedToolIds: ['email-header-analyzer', 'email-normalizer', 'certificate-inspector'],
  resultActions: ['copy', 'scratch', 'save'],
  run: ({ fields, text }) => runEmailAuth(text, fields),
};

function withModeDefault(id: string, name: string, mode: string): ToolDefinition {
  return {
    ...emailAuthRecordsTool,
    aliasOf: 'email-auth-records',
    fields: emailAuthRecordsTool.fields?.map((entry) =>
      entry.id === 'mode' ? { ...entry, defaultValue: mode } : entry,
    ),
    id,
    name,
  };
}

export const spfRecordTool: ToolDefinition = withModeDefault(
  'spf-record',
  'SPF Record Builder',
  'spf',
);

export const dmarcRecordTool: ToolDefinition = withModeDefault(
  'dmarc-record',
  'DMARC Record Builder',
  'dmarc',
);

function runEmailAuth(text: string, fields: Record<string, string>): ToolResult {
  switch (fields.mode || 'parse') {
    case 'parse': {
      const report = withToolError(() => webFunctions.parseEmailAuthRecord(text));

      return identityOutput(report.text, 'email-auth-report.txt', report.summary, false);
    }

    case 'spf':
      return buildSpfResult(fields);
    case 'dmarc':
      return buildDmarcResult(fields);
    case 'dkim':
      return buildDkimResult(text, fields);
    default:
      throw new ToolError('Choose Parse, Build SPF, Build DMARC or Build DKIM.');
  }
}

function recordText(record: string, findings: Finding[]): string {
  const rows = findings.length > 0 ? findings.map((f) => `- ${f.level}: ${f.message}`) : ['None'];

  return [record, '', '# Findings', ...rows].join('\n');
}

function buildSpfResult(fields: Record<string, string>): ToolResult {
  const built = withToolError(() =>
    webFunctions.buildSpf({
      a: fields.a === 'true',
      all: fields.all ?? '-all',
      includes: fields.includes,
      ip4: fields.ip4,
      ip6: fields.ip6,
      mx: fields.mx === 'true',
      redirect: fields.redirect,
    }),
  );

  return identityOutput(
    recordText(built.record, built.findings),
    'spf.txt',
    `SPF record · ${built.lookups} of 10 lookups · ${webFunctions.summarizeFindings(built.findings)}`,
    false,
  );
}

// Alignment, percentage and failure options equal to the protocol defaults are left out.
const unlessDefault = (value: string | undefined, standard: string) =>
  value === standard ? undefined : value;

function buildDmarcResult(fields: Record<string, string>): ToolResult {
  const policy = fields.policy ?? 'reject';
  const built = withToolError(() =>
    webFunctions.buildDmarc({
      adkim: unlessDefault(fields.adkim, 'r'),
      aspf: unlessDefault(fields.aspf, 'r'),
      fo: unlessDefault(fields.fo, '0'),
      pct: unlessDefault(fields.pct, '100'),
      policy,
      rua: fields.rua,
      ruf: fields.ruf,
      subdomainPolicy: fields.subdomainPolicy,
    }),
  );

  return identityOutput(
    recordText(built.record, built.findings),
    'dmarc.txt',
    `DMARC record · p=${policy} · ${webFunctions.summarizeFindings(built.findings)}`,
    false,
  );
}

function buildDkimResult(text: string, fields: Record<string, string>): ToolResult {
  const keyType = fields.keyType || 'rsa';
  const built = withToolError(() =>
    webFunctions.buildDkim({
      domain: fields.domain ?? '',
      keyType,
      publicKey: text,
      selector: fields.selector ?? '',
      testing: fields.testing === 'true',
    }),
  );
  const size = built.keyBits ? ` ${built.keyBits.toLocaleString('en-US')}-bit` : '';

  return identityOutput(
    [`Host: ${built.host}`, `Record: ${built.record}`, `Zone: ${built.zone}`].join('\n'),
    'dkim.txt',
    `DKIM record · ${keyType}${size} · ${built.host}`,
    false,
  );
}

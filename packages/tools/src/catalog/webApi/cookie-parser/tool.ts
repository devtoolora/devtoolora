import { ToolDefinition, ToolResult } from '@devtoolora/core';
import * as webFunctions from '@devtoolora/functions/web';
import { withToolError } from '../../../adapters/errors';
import { browserSafeCapabilities, identityOutput } from '../shared';

const buildOnly = { field: 'mode', is: ['build'] };

export const cookieParserTool: ToolDefinition = {
  id: 'cookie-parser',
  name: 'Cookie Parser & Set-Cookie Builder',
  category: 'Web/API',
  description:
    'Parse Cookie and Set-Cookie headers into attributes and security findings, or build a Set-Cookie header from fields.',
  samples: [
    {
      fields: { mode: 'parse' },
      label: 'Session cookie with all flags',
      text: 'Set-Cookie: sid=abc123; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=3600',
    },
    {
      fields: { mode: 'parse' },
      label: 'Request Cookie header',
      text: 'Cookie: theme=dark; lang=cs; sid=abc',
    },
    {
      fields: { mode: 'parse' },
      label: '__Host- prefix violation',
      text: 'Set-Cookie: __Host-id=1; Path=/app; Secure',
    },
    {
      fields: { mode: 'parse' },
      label: 'SameSite=None without Secure',
      text: 'Set-Cookie: tracker=1; SameSite=None',
    },
    {
      fields: { mode: 'parse' },
      label: 'Expired cookie',
      text: 'Set-Cookie: old=1; Expires=Wed, 21 Oct 2015 07:28:00 GMT',
    },
    {
      fields: { mode: 'build', name: 'sid', value: 'abc' },
      label: 'Build a hardened cookie',
      text: '',
    },
  ],
  inputKind: 'text',
  inputVisibleWhen: { field: 'mode', is: ['parse'] },
  outputKind: 'json',
  supportsSelection: true,
  capabilities: browserSafeCapabilities,
  freshResults: true,
  sensitiveInput: true,
  fields: [
    {
      defaultValue: 'parse',
      id: 'mode',
      label: 'Mode',
      options: [
        { label: 'Parse', value: 'parse' },
        { label: 'Build', value: 'build' },
      ],
      presentation: 'segmented',
      type: 'select',
    },
    {
      defaultValue: '',
      id: 'name',
      label: 'Name',
      required: true,
      type: 'text',
      visibleWhen: buildOnly,
    },
    { defaultValue: '', id: 'value', label: 'Value', type: 'text', visibleWhen: buildOnly },
    { defaultValue: '', id: 'domain', label: 'Domain', type: 'text', visibleWhen: buildOnly },
    { defaultValue: '/', id: 'path', label: 'Path', type: 'text', visibleWhen: buildOnly },
    {
      help: 'ISO 8601 or any date text; written as an IMF-fixdate.',
      defaultValue: '',
      id: 'expires',
      label: 'Expires',
      type: 'text',
      visibleWhen: buildOnly,
    },
    {
      defaultValue: '',
      id: 'maxAge',
      label: 'Max-Age (seconds)',
      type: 'text',
      visibleWhen: buildOnly,
    },
    {
      defaultValue: 'true',
      id: 'secure',
      label: 'Secure',
      type: 'checkbox',
      visibleWhen: buildOnly,
    },
    {
      defaultValue: 'true',
      id: 'httpOnly',
      label: 'HttpOnly',
      type: 'checkbox',
      visibleWhen: buildOnly,
    },
    {
      defaultValue: 'Lax',
      id: 'sameSite',
      label: 'SameSite',
      options: [
        { label: 'Lax', value: 'Lax' },
        { label: 'Strict', value: 'Strict' },
        { label: 'None', value: 'None' },
      ],
      type: 'select',
      visibleWhen: buildOnly,
    },
    {
      defaultValue: 'false',
      id: 'partitioned',
      label: 'Partitioned',
      type: 'checkbox',
      visibleWhen: buildOnly,
    },
  ],
  keywords: [
    'cookie',
    'cookie parser',
    'set-cookie',
    'set-cookie builder',
    'samesite',
    'httponly',
    'secure cookie',
    '__host',
    'cookie header',
    'cookie flags',
  ],
  relatedToolIds: ['http-headers-parser', 'jwt-parse', 'secret-redactor'],
  resultActions: ['copy', 'scratch', 'save'],
  run: ({ fields, text }) => (fields.mode === 'build' ? buildCookie(fields) : parseCookie(text)),
};

function plural(count: number): string {
  return count === 1 ? '1 cookie' : `${count} cookies`;
}

function parseCookie(text: string): ToolResult {
  const report = withToolError(() => webFunctions.parseCookies(text));
  const findings = report.cookies.flatMap((cookie) => cookie.findings);

  return identityOutput(
    JSON.stringify(report, null, 2),
    'cookies.json',
    `${plural(report.cookies.length)} · ${webFunctions.summarizeFindings(findings)}`,
    true,
  );
}

function buildCookie(fields: Record<string, string>): ToolResult {
  const built = withToolError(() =>
    webFunctions.buildSetCookie({
      domain: fields.domain,
      expires: fields.expires,
      httpOnly: fields.httpOnly === 'true',
      maxAge: fields.maxAge,
      name: fields.name ?? '',
      partitioned: fields.partitioned === 'true',
      path: fields.path,
      sameSite: fields.sameSite,
      secure: fields.secure === 'true',
      value: fields.value ?? '',
    }),
  );
  const lines = built.findings.map(({ level, message }) => `# ${level}: ${message}`);

  return identityOutput(
    [built.header, ...lines].join('\n'),
    'set-cookie.txt',
    `Set-Cookie built · ${webFunctions.summarizeFindings(built.findings)}`,
    false,
  );
}

import { ToolDefinition, ToolResult } from '@devtoolora/core';
import * as webFunctions from '@devtoolora/functions/web';
import { withToolError } from '../../../adapters/errors';
import { browserSafeCapabilities, identityOutput } from '../shared';

const buildOnly = { field: 'mode', is: ['build'] };

export const connectionStringTool: ToolDefinition = {
  id: 'connection-string',
  name: 'Connection String Builder & Parser',
  category: 'Web/API',
  description:
    'Parse PostgreSQL, MySQL, MongoDB and Redis connection strings into hosts, credentials, options and TLS findings, or build one with a JDBC form and a .env line.',
  samples: [
    {
      fields: { mode: 'parse' },
      label: 'Parse PostgreSQL with sslmode',
      text: 'postgres://app:s3cr%40t@db.example.com:5433/appdb?sslmode=require',
    },
    {
      fields: { mode: 'parse' },
      label: 'Parse MongoDB replica set',
      text: 'mongodb://a.example:27017,b.example:27018/app?replicaSet=rs0',
    },
    {
      fields: { mode: 'parse' },
      label: 'Parse rediss',
      text: 'rediss://:pw@cache.example:6380/2',
    },
    {
      fields: { mode: 'parse' },
      label: 'Parse JDBC MySQL',
      text: 'jdbc:mysql://db.example.com/shop?user=shop&password=pw&useSSL=true',
    },
    {
      fields: {
        database: 'appdb',
        dialect: 'postgres',
        host: 'db.example.com',
        mode: 'build',
        password: 's3cr@t',
        tls: 'true',
        username: 'app',
      },
      label: 'Build PostgreSQL',
      text: '',
    },
    {
      fields: {
        database: 'app',
        dialect: 'mongodb',
        host: 'mongo.example.com',
        mode: 'build',
        options: 'retryWrites=true\nw=majority',
        tls: 'true',
      },
      label: 'Build MongoDB with options',
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
      defaultValue: 'postgres',
      id: 'dialect',
      label: 'Dialect',
      options: [
        { label: 'PostgreSQL', value: 'postgres' },
        { label: 'MySQL', value: 'mysql' },
        { label: 'MongoDB', value: 'mongodb' },
        { label: 'Redis', value: 'redis' },
      ],
      type: 'select',
      visibleWhen: buildOnly,
    },
    {
      defaultValue: 'localhost',
      id: 'host',
      label: 'Host',
      required: true,
      type: 'text',
      visibleWhen: buildOnly,
    },
    {
      help: 'Empty uses the dialect default (5432, 3306, 27017 or 6379).',
      defaultValue: '',
      id: 'port',
      label: 'Port',
      type: 'text',
      visibleWhen: buildOnly,
    },
    { defaultValue: '', id: 'username', label: 'User', type: 'text', visibleWhen: buildOnly },
    {
      defaultValue: '',
      id: 'password',
      label: 'Password',
      type: 'password',
      visibleWhen: buildOnly,
    },
    {
      help: 'Redis takes the numeric database index.',
      defaultValue: '',
      id: 'database',
      label: 'Database',
      type: 'text',
      visibleWhen: buildOnly,
    },
    {
      defaultValue: '',
      id: 'options',
      label: 'Options (key=value per line)',
      type: 'textarea',
      visibleWhen: buildOnly,
    },
    {
      defaultValue: 'true',
      id: 'tls',
      label: 'Require TLS',
      type: 'checkbox',
      visibleWhen: buildOnly,
    },
  ],
  keywords: [
    'connection string',
    'database url',
    'postgres',
    'postgresql',
    'mysql',
    'mongodb',
    'redis',
    'jdbc',
    'dsn',
    'database_url',
  ],
  relatedToolIds: ['url-parse', 'secret-redactor', 'dotenv-formatter'],
  resultActions: ['copy', 'scratch', 'save'],
  run: ({ fields, text }) =>
    fields.mode === 'build' ? buildConnection(fields) : parseConnection(text),
};

function plural(count: number): string {
  return count === 1 ? '1 host' : `${count} hosts`;
}

function tlsLabel(report: webFunctions.ConnectionReport): string {
  if (report.tls) return 'TLS on';

  return report.tlsOptional ? 'TLS optional' : 'TLS off';
}

function parseConnection(text: string): ToolResult {
  const report = withToolError(() => webFunctions.parseConnectionString(text));
  const [first] = report.hosts;
  const target =
    report.hosts.length === 1 && first
      ? `${first.host}:${first.port}`
      : plural(report.hosts.length);
  const parts = [
    webFunctions.dialectLabel(report.dialect),
    target,
    ...(report.database ? [`database ${report.database}`] : []),
    tlsLabel(report),
    report.password === undefined ? 'no password' : 'password present',
    webFunctions.summarizeFindings(report.findings),
  ];

  return identityOutput(
    JSON.stringify(report, null, 2),
    'connection-string.json',
    parts.join(' · '),
    true,
  );
}

function buildConnection(fields: Record<string, string>): ToolResult {
  const built = withToolError(() =>
    webFunctions.buildConnectionString({
      database: fields.database,
      dialect: fields.dialect ?? 'postgres',
      host: fields.host ?? '',
      options: fields.options,
      password: fields.password,
      port: fields.port,
      tls: fields.tls === 'true',
      username: fields.username,
    }),
  );
  const dialect = (fields.dialect ?? 'postgres') as webFunctions.ConnectionDialect;
  const hostCount =
    (built.uri.split('//')[1] ?? '').split(/[/?]/)[0]?.split('@').pop()?.split(',').length ?? 1;
  const lines = [
    `URI: ${built.uri}`,
    ...(built.jdbc === undefined ? [] : [`JDBC: ${built.jdbc}`]),
    `.env: ${built.env}`,
    ...built.findings.map(({ level, message }) => `# ${level}: ${message}`),
  ];

  return identityOutput(
    lines.join('\n'),
    'connection-string.txt',
    `${webFunctions.dialectLabel(dialect)} · ${plural(hostCount)} · ${fields.tls === 'true' ? 'TLS on' : 'TLS not required'} · ${webFunctions.summarizeFindings(built.findings)}`,
    false,
  );
}

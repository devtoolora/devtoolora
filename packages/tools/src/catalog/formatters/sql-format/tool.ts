import { ToolDefinition, ToolError } from '@devtoolora/core';
import { formatSql as formatSqlValue, SQL_DIALECTS } from '@devtoolora/functions/format';
import type { SqlFormatOptions } from '@devtoolora/functions/format';
import { encodeBase64Text } from '@devtoolora/functions/encoding';
import { withToolErrorAsync } from '../../../adapters/errors';
import { indentationField, browserSafeCapabilities } from '../shared';

function sqlFormatOptions(fields: Record<string, string>): SqlFormatOptions {
  const dialect = SQL_DIALECTS.find((candidate) => candidate === (fields.dialect || 'sql'));

  if (!dialect) throw new ToolError('Choose a supported SQL dialect.');

  const indentation = indentationField(fields);
  const keywordCase = fields.keywordCase || 'upper';

  if (keywordCase !== 'upper' && keywordCase !== 'lower' && keywordCase !== 'preserve')
    throw new ToolError('Choose uppercase, lowercase or preserved keywords.');

  return { dialect, indentation, keywordCase };
}

export const sqlFormatTool: ToolDefinition = {
  capabilities: browserSafeCapabilities,
  category: 'Formatters',
  description:
    'Format SQL queries by dialect with readable indentation, preserved literals and configurable keyword case.',
  fields: [
    {
      defaultValue: 'sql',
      help: 'Choose the database syntax; Standard SQL is a common subset, not automatic dialect detection.',
      id: 'dialect',
      label: 'SQL dialect',
      options: [
        { label: 'Standard SQL', value: 'sql' },
        { label: 'PostgreSQL', value: 'postgresql' },
        { label: 'MySQL', value: 'mysql' },
        { label: 'SQLite', value: 'sqlite' },
        { label: 'SQL Server (T-SQL)', value: 'transactsql' },
        { label: 'BigQuery', value: 'bigquery' },
        { label: 'Oracle SQL', value: 'plsql' },
      ],
      type: 'select',
    },
    {
      defaultValue: '2',
      id: 'indentation',
      label: 'Indentation',
      options: [
        { label: '2 spaces', value: '2' },
        { label: '4 spaces', value: '4' },
        { label: 'Tabs', value: 'tab' },
      ],
      presentation: 'segmented',
      type: 'select',
    },
    {
      defaultValue: 'upper',
      id: 'keywordCase',
      label: 'Keyword case',
      options: [
        { label: 'UPPERCASE', value: 'upper' },
        { label: 'lowercase', value: 'lower' },
        { label: 'Preserve', value: 'preserve' },
      ],
      presentation: 'segmented',
      type: 'select',
    },
  ],
  id: 'sql-format',
  inputKind: 'text',
  keywords: [
    'sql',
    'formatter',
    'pretty print',
    'postgresql',
    'mysql',
    'sqlite',
    'tsql',
    'bigquery',
    'oracle',
    'indentation',
  ],
  name: 'SQL Formatter',
  outputKind: 'text',
  relatedToolIds: ['text-diff', 'json-format', 'json-to-csv'],
  resultActions: ['copy', 'replace', 'insert', 'scratch', 'save'],
  run: ({ fields, text }) =>
    withToolErrorAsync(async () => {
      const formatted = await formatSqlValue(text, sqlFormatOptions(fields));

      return {
        artifact: {
          base64: encodeBase64Text(formatted),
          fileName: 'formatted.sql',
          mimeType: 'text/plain;charset=utf-8',
        },
        language: 'sql',
        summary: `SQL formatted · ${fields.dialect || 'sql'} · not executed or validated.`,
        text: formatted,
      };
    }),
  samples: [
    {
      fields: { dialect: 'sql', indentation: '2', keywordCase: 'upper' },
      label: 'SELECT query with JOIN',
      text: 'select u.id, u.name, count(o.id) as orders_count from users u left join orders o on u.id = o.user_id where u.active = 1 group by u.id, u.name order by orders_count desc limit 10;',
    },
    {
      fields: { dialect: 'sql', indentation: '2', keywordCase: 'upper' },
      label: 'Literals and comments',
      text: "select 'from users,  where id' as note, 'it''s  fine' as message -- from orders,  where active\nfrom users /* order by,  untouched */ where id = 1;",
    },
    {
      fields: { dialect: 'postgresql', indentation: '2', keywordCase: 'upper' },
      label: 'PostgreSQL CTE',
      text: 'with recent as (select id, name from users where created_at >= $1) select name, $$from  users$$ as note from recent order by name;',
    },
    {
      fields: { dialect: 'transactsql', indentation: '2', keywordCase: 'upper' },
      label: 'SQL Server parameters',
      text: 'select top 10 [from], @id as requested_id from [order] where [id] = @id order by [from];',
    },
    {
      fields: { dialect: 'mysql', indentation: '4', keywordCase: 'lower' },
      label: 'MySQL upsert with backticks',
      text: "INSERT INTO `orders` (`id`, `status`) VALUES (1, 'new'), (2, 'paid') ON DUPLICATE KEY UPDATE `status` = VALUES(`status`);",
    },
    {
      fields: { dialect: 'sqlite', indentation: 'tab', keywordCase: 'upper' },
      label: 'SQLite schema and insert',
      text: "create table users (id integer primary key autoincrement, email text not null unique, created_at text default current_timestamp); insert into users (email) values ('ada@example.com');",
    },
    {
      fields: { dialect: 'mysql', indentation: '2', keywordCase: 'upper' },
      label: 'MySQL procedure with DELIMITER',
      text: "DELIMITER //\ncreate procedure add_user(in p_email varchar(255)) BEGIN insert into users (email) values (p_email); select last_insert_id(); end //\nDELIMITER ;\ncall add_user('ada@example.com');",
    },
    {
      fields: { dialect: 'bigquery', indentation: '2', keywordCase: 'upper' },
      label: 'BigQuery window query',
      text: 'select user_id, count(*) as events from `my-project.analytics.events` where date(ts) = @run_date group by user_id qualify row_number() over (partition by user_id order by max(ts) desc) = 1;',
    },
  ],
  supportsSelection: true,
};

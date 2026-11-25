import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { browserSchemaTypeTools as schemaTypeTools } from '@devtoolora/tools';
import { ToolError } from '@devtoolora/core';
import { contentOf } from './toolContent';
import { result, run } from './tools.helpers';

describe('schema and typed data tools', () => {
  const sample =
    '{"id":1,"name":"Ada","roles":["admin"],"profile":{"active":true,"score":98},"nickname":null}';
  const userList =
    '[{"id":1,"name":"Ada","active":true},{"id":2,"name":"Grace","email":"grace@example.com"}]';

  it('validates JSON against JSON Schema with readable AJV errors', async () => {
    assert.match(
      await run('json-schema-validator', '{"name":"Ada","age":37}', {
        schema:
          '{"type":"object","required":["name"],"properties":{"name":{"type":"string"},"age":{"type":"number"}}}',
      }),
      /^Valid against schema\.\nDraft: draft-07\nFormat checks: on\nErrors: 0$/,
    );

    assert.match(
      await run('json-schema-validator', '{"age":"old"}', {
        schema: '{"type":"object","required":["name"],"properties":{"age":{"type":"number"}}}',
      }),
      /Invalid against schema\.[\s\S]*\$ — must have required property "name" \[required\][\s\S]*\/age — must be number \[type\]/,
    );

    await assert.rejects(
      () => run('json-schema-validator', '{"ok":true}', { schema: '{"type":' }),
      ToolError,
    );
  });

  it('generates deterministic JSON Schema from merged sample arrays', async () => {
    assert.deepEqual(JSON.parse(await run('json-schema-generator', userList)), {
      $schema: 'https://json-schema.org/draft/2020-12/schema',
      items: {
        additionalProperties: false,
        properties: {
          active: { type: 'boolean' },
          email: { type: 'string' },
          id: { type: 'integer' },
          name: { type: 'string' },
        },
        required: ['id', 'name'],
        type: 'object',
      },
      type: 'array',
    });
  });

  it('provides complete JSON Schema guides, runnable examples and exact saved artifacts', async () => {
    for (const id of ['json-schema-generator', 'json-schema-validator']) {
      const tool = schemaTypeTools.find((entry) => entry.id === id);

      assert.ok(tool);
      assert.equal(contentOf(tool).documentation?.length, 2);
      assert.ok((contentOf(tool).help?.split('\n\n').length ?? 0) >= 4);
      assert.ok((contentOf(tool).examples?.length ?? 0) >= 5);
      assert.ok((contentOf(tool).notes?.length ?? 0) >= 7);
      assert.deepEqual(tool.resultActions, ['copy', 'replace', 'insert', 'scratch', 'save']);

      for (const sample of tool.samples ?? []) {
        const output = await result(id, sample.text ?? '', sample.fields);

        assert.ok(output.artifact);
        assert.equal(Buffer.from(output.artifact.base64, 'base64').toString('utf8'), output.text);

        assert.equal(
          output.artifact.fileName,
          id === 'json-schema-generator'
            ? 'schema.json'
            : sample.fields?.report === 'json'
              ? 'validation-report.json'
              : 'validation-report.txt',
        );

        if (id === 'json-schema-generator') {
          const validation = await run('json-schema-validator', sample.text ?? '', {
            report: 'json',
            schema: output.text,
          });

          assert.equal(JSON.parse(validation).valid, true, sample.label);
        }
      }
    }
  });

  it('shares schema option behavior and draft-aware reports through the worker catalog', async () => {
    const generated = await run('json-schema-generator', '{"id":1,"nested":{"name":"Ada"}}', {
      additionalProperties: 'true',
      draft: '2019-09',
      requiredProperties: 'none',
    });
    const valid = JSON.parse(
      await run('json-schema-validator', '{"nested":{"extra":true},"new":1}', {
        report: 'json',
        schema: generated,
      }),
    );

    assert.equal(valid.valid, true);
    assert.equal(valid.draft, '2019-09');
    const invalid = JSON.parse(
      await run('json-schema-validator', '"2026-02-30"', {
        report: 'json',
        schema: '{"type":"string","format":"date"}',
      }),
    );

    assert.equal(invalid.valid, false);
    assert.equal(invalid.errors[0].keyword, 'format');
    const ignored = await run('json-schema-validator', '"2026-02-30"', {
      schema: '{"type":"string","format":"date"}',
      validateFormats: 'false',
    });

    assert.match(ignored, /Format checks: off \(format constraints ignored\)/);
    const generatorInvalidOptions: Array<Record<string, string>> = [
      { draft: 'bad' },
      { requiredProperties: 'bad' },
      { additionalProperties: 'bad' },
    ];

    for (const fields of generatorInvalidOptions) {
      await assert.rejects(() => run('json-schema-generator', '{}', fields), ToolError);
    }

    const validatorInvalidOptions: Array<Record<string, string>> = [
      { draft: 'bad' },
      { report: 'bad' },
      { validateFormats: 'bad' },
      { allErrors: 'bad' },
    ];

    for (const fields of validatorInvalidOptions) {
      await assert.rejects(
        () => run('json-schema-validator', '{}', { ...fields, schema: '{}' }),
        ToolError,
      );
    }
  });

  it('generates deterministic TypeScript and Zod from nested JSON', async () => {
    assert.equal(
      await run('json-to-typescript', sample, { rootName: 'User' }),
      [
        'export interface User {',
        '  id: number;',
        '  name: string;',
        '  roles: string[];',
        '  profile: UserProfile;',
        '  nickname: null;',
        '}',
        '',
        'export interface UserProfile {',
        '  active: boolean;',
        '  score: number;',
        '}',
      ].join('\n'),
    );

    assert.equal(
      await run('json-to-zod', sample, { rootName: 'User' }),
      [
        "import { z } from 'zod';",
        '',
        'export const UserSchema = z.object({',
        '  id: z.int(),',
        '  name: z.string(),',
        '  roles: z.array(z.string()),',
        '  profile: z.object({',
        '    active: z.boolean(),',
        '    score: z.int(),',
        '  }),',
        '  nickname: z.null(),',
        '});',
        '',
        'export type User = z.infer<typeof UserSchema>;',
      ].join('\n'),
    );
  });

  it('documents TypeScript and Zod generation with runnable samples, options and exact artifacts', async () => {
    for (const id of ['json-to-typescript', 'json-to-zod']) {
      const tool = schemaTypeTools.find((entry) => entry.id === id);

      assert.ok(tool);
      assert.equal(contentOf(tool).documentation?.length, 2);
      assert.equal(tool.samples?.length, 6);
      assert.equal(contentOf(tool).help?.split('\n\n').length, 4);
      assert.ok((contentOf(tool).examples?.length ?? 0) >= 6);
      assert.ok((contentOf(tool).notes?.length ?? 0) >= 7);
      assert.ok(tool.autoRun && tool.freshResults);
      const fieldIds = (tool.fields ?? []).map((field) => field.id).sort();

      for (const entry of tool.samples ?? []) {
        assert.deepEqual(Object.keys(entry.fields ?? {}).sort(), fieldIds);
        const output = await result(id, entry.text ?? '', entry.fields);

        assert.equal(
          Buffer.from(output.artifact?.base64 ?? '', 'base64').toString('utf8'),
          `${output.text}\n`,
        );

        assert.equal(
          output.artifact?.fileName,
          id === 'json-to-typescript' ? 'types.ts' : 'schema.ts',
        );
      }
    }

    assert.equal(
      await run('json-to-typescript', userList, {
        declaration: 'type',
        exported: 'false',
        readonly: 'true',
        rootName: 'users',
      }),
      [
        'type Users = readonly User[];',
        '',
        'type User = {',
        '  readonly id: number;',
        '  readonly name: string;',
        '  readonly active?: boolean;',
        '  readonly email?: string;',
        '};',
      ].join('\n'),
    );

    assert.match(
      (await result('json-to-typescript', userList)).summary ?? '',
      /^2 declarations · /,
    );

    const zod3 = await run('json-to-zod', userList, {
      exportType: 'false',
      rootName: 'Users',
      strictObjects: 'true',
      version: '3',
    });

    assert.match(zod3, /email: z\.string\(\)\.email\(\)\.optional\(\),\n\}\)\.strict\(\)\);$/);
    assert.doesNotMatch(zod3, /z\.infer/);

    assert.match(
      await run('json-to-zod', userList, { optionalProperties: 'all' }),
      /id: z\.int\(\)\.optional\(\),/,
    );

    for (const [id, fields] of [
      ['json-to-typescript', { declaration: 'class' }],
      ['json-to-typescript', { readonly: 'yes' }],
      ['json-to-zod', { version: '5' }],
      ['json-to-zod', { inferFormats: 'maybe' }],
      ['json-to-zod', { optionalProperties: 'some' }],
    ] as const) {
      await assert.rejects(() => run(id, '{}', fields), ToolError);
    }

    await assert.rejects(() => run('json-to-typescript', '{"a":'), {
      message: /^Invalid JSON at line 1, column 6 \(offset 5\): /,
    });
  });

  it('profiles CSV columns with quoted commas, missing values, and inferred types', async () => {
    const profile = await run(
      'csv-profiler',
      'name,age,active,joined,note\n"Ada, A.",37,true,2026-01-01,"first user"\nGrace,,false,2026-02-15,"second,user"',
    );

    assert.match(profile, /Rows: 2/);
    assert.match(profile, /Columns: 5/);
    assert.match(profile, /## age\nType: integer\nMissing: 1\nUnique: 1\nMin: 37\nMax: 37/);

    assert.match(
      profile,
      /## joined\nType: date\nMissing: 0\nUnique: 2\nMin: 2026-01-01\nMax: 2026-02-15/,
    );

    assert.match(profile, /Samples: "Ada, A\.", "Grace"/);
    await assert.rejects(() => run('csv-profiler', 'a,b\n"unterminated,2'), ToolError);
  });
});

describe('config and secrets tools', () => {
  const sample =
    '# App configuration\n export PORT = 3000\nAPI_URL=${BASE_URL}/v1 # public endpoint\nAPI_TOKEN="abc # 123"\n';

  it('parses common dotenv syntax and formats it without reordering source lines', async () => {
    assert.equal(
      await run('dotenv-formatter', sample),
      '# App configuration\nexport PORT=3000\nAPI_URL=${BASE_URL}/v1 # public endpoint\nAPI_TOKEN="abc # 123"\n',
    );
  });

  it('reports all dotenv validation issues with line numbers and preserves variable references', async () => {
    assert.equal(
      await run('dotenv-validator', 'PORT=3000\nAPI_URL=${BASE_URL}/v1\n'),
      'Valid .env\nVariables: 2\nAssignments: 2',
    );

    const invalid = await run(
      'dotenv-validator',
      'BAD-NAME=value\nPORT=3000\nPORT=4000\nTOKEN="unterminated',
    );

    assert.match(invalid, /Invalid \.env/);
    assert.match(invalid, /Line 1: Invalid variable name "BAD-NAME"\./);
    assert.match(invalid, /Line 3: Duplicate variable "PORT" \(first declared on line 2\)\./);
    assert.match(invalid, /Line 4: Unterminated quoted value\./);
  });

  it('redacts conventional and explicit sensitive names without touching safe values', async () => {
    assert.equal(
      await run(
        'secret-redactor',
        '# Share this\nPORT=3000\nAPI_TOKEN="live # token"\nPASSWORD=secret\nDATABASE_URL=postgres://user:pass@localhost/app\nAPI_URL=https://example.com\n',
        {
          additionalNames: 'DATABASE_URL',
        },
      ),
      'PORT=3000\nAPI_TOKEN=<redacted>\nPASSWORD=<redacted>\nDATABASE_URL=<redacted>\nAPI_URL=https://example.com\n',
    );
  });

  it('rejects malformed input before formatting or redacting it', async () => {
    await assert.rejects(() => run('dotenv-formatter', 'TOKEN="unterminated'), ToolError);
    await assert.rejects(() => run('secret-redactor', 'BAD-NAME=value'), ToolError);
  });
});

describe('logs and diagnostics tools', () => {
  it('inspects mixed JSON Lines input without discarding valid records', async () => {
    assert.equal(
      await run(
        'json-lines-inspector',
        '{"level":"info","id":1}\n{"level":"error","id":2,"retry":true}\nnot json',
      ),
      [
        '# JSON Lines Inspector',
        '',
        'Records: 3',
        'Valid objects: 2',
        'Malformed: 1',
        '',
        '## id',
        'Types: integer',
        'Present: 2/2',
        '',
        '## level',
        'Types: string',
        'Present: 2/2',
        '',
        '## retry',
        'Types: boolean',
        'Present: 1/2',
        '',
        '## Diagnostics',
        '- Line 3: Invalid JSON.',
      ].join('\n'),
    );

    await assert.rejects(() => run('json-lines-inspector', ' \n\n'), ToolError);
  });

  it('filters log lines with include and exclude regex patterns', async () => {
    assert.equal(
      await run(
        'log-filter',
        'INFO started\nWARN cache miss\nERROR database timeout\nERROR healthcheck failed',
        { includePattern: 'warn|error', excludePattern: 'healthcheck', flags: 'i' },
      ),
      'WARN cache miss\nERROR database timeout',
    );

    assert.equal(
      await run('log-filter', 'INFO started', {
        includePattern: 'error',
        excludePattern: '',
        flags: 'i',
      }),
      '',
    );

    await assert.rejects(
      () =>
        run('log-filter', 'INFO started', { includePattern: '', excludePattern: '', flags: 'i' }),
      ToolError,
    );

    await assert.rejects(
      () =>
        run('log-filter', 'INFO started', { includePattern: '[', excludePattern: '', flags: 'i' }),
      ToolError,
    );
  });

  it('redacts log secrets while keeping line structure and safe fields', async () => {
    assert.equal(
      await run(
        'raw-log-redactor',
        'Authorization: Bearer secret-token\nGET /v1?api_key=live-key&page=1\npassword=hunter2\n{"token":"abc","user":"ada"}\nDATABASE_URL=postgres://secret\nuser=ada',
        { additionalNames: 'DATABASE_URL' },
      ),
      'Authorization: <redacted>\nGET /v1?api_key=<redacted>&page=1\npassword=<redacted>\n{"token":"<redacted>","user":"ada"}\nDATABASE_URL=<redacted>\nuser=ada',
    );
  });

  it('cleans JavaScript and Python stack traces with ordered unique frames', async () => {
    const javascript = await run(
      'stack-trace-cleaner',
      'TypeError: bad input\n    at parse (/app/a.ts:1:2)\n    at parse (/app/a.ts:1:2)\n    at main (/app/b.ts:3:4)',
    );

    assert.equal(
      javascript,
      '# Stack Trace\n\nException: TypeError: bad input\nFrames: 2\n\n1. at parse (/app/a.ts:1:2)\n2. at main (/app/b.ts:3:4)',
    );

    const python = await run(
      'stack-trace-cleaner',
      'Traceback (most recent call last):\n  File "app.py", line 10, in run\n    execute()\n  File "worker.py", line 4, in execute\n    raise ValueError("bad")\nValueError: bad',
    );

    assert.equal(
      python,
      '# Stack Trace\n\nException: ValueError: bad\nFrames: 2\n\n1. File "app.py", line 10, in run\n2. File "worker.py", line 4, in execute',
    );

    await assert.rejects(() => run('stack-trace-cleaner', 'ordinary log line'), ToolError);
  });
});

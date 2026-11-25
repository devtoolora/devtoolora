import assert from 'node:assert/strict';
import { ToolError } from '@devtoolora/core';
import { describe, it } from 'vitest';
import { systemdUnitBuilderTool } from '../src/catalog/devUtilities';

const defaults = Object.fromEntries(
  (systemdUnitBuilderTool.fields ?? []).map((field) => [field.id, field.defaultValue ?? '']),
);

describe('systemd unit builder tool', () => {
  it('declares its fields', () => {
    assert.equal(systemdUnitBuilderTool.id, 'systemd-unit-builder');
    assert.equal(systemdUnitBuilderTool.name, 'systemd Service Unit Builder');
    assert.equal(systemdUnitBuilderTool.category, 'Dev Utilities');
    assert.equal(systemdUnitBuilderTool.inputKind, 'none');
    assert.equal(systemdUnitBuilderTool.outputKind, 'text');
    assert.equal(systemdUnitBuilderTool.autoRun, true);
    assert.equal(systemdUnitBuilderTool.freshResults, true);
    assert.deepEqual(systemdUnitBuilderTool.resultActions, ['copy', 'scratch', 'save']);

    assert.deepEqual(
      systemdUnitBuilderTool.fields?.map(({ defaultValue, id, type }) => [id, type, defaultValue]),
      [
        ['unitName', 'text', 'myapp'],
        ['description', 'text', 'My app'],
        ['execStart', 'textarea', undefined],
        ['workingDirectory', 'text', undefined],
        ['scope', 'select', 'system'],
        ['user', 'text', undefined],
        ['group', 'text', undefined],
        ['type', 'select', 'simple'],
        ['restart', 'select', 'on-failure'],
        ['restartSec', 'number', '5'],
        ['environment', 'textarea', undefined],
        ['environmentFile', 'text', undefined],
        ['networkOnline', 'checkbox', 'true'],
        ['hardening', 'checkbox', 'true'],
      ],
    );

    assert.equal(
      systemdUnitBuilderTool.fields?.find((f) => f.id === 'environment')?.sensitive,
      true,
    );
  });

  it('builds the unit file and its artifact', async () => {
    const result = await systemdUnitBuilderTool.run({
      fields: {
        ...defaults,
        environment: 'NODE_ENV=production\nPORT=8080',
        execStart: '/usr/bin/node /srv/myapp/server.js',
        user: 'myapp',
        workingDirectory: '/srv/myapp',
      },
      text: '',
    });

    assert.equal(result.summary, 'myapp.service · system unit · 2 environment variables');
    assert.equal(result.artifact?.fileName, 'myapp.service');
    assert.equal(result.artifact?.mimeType, 'text/plain;charset=utf-8');

    assert.equal(
      Buffer.from(result.artifact?.base64 ?? '', 'base64').toString('utf8'),
      result.text,
    );

    assert.match(result.text ?? '', /^\[Unit\]\nDescription=My app\n/);
  });

  it('ignores the hidden restart delay when Restart is no', async () => {
    const result = await systemdUnitBuilderTool.run({
      fields: { ...defaults, execStart: '/usr/bin/a', restart: 'no', restartSec: '' },
      text: '',
    });

    assert.doesNotMatch(result.text ?? '', /RestartSec/);
  });

  it('appends warnings to the summary and rejects bad input', async () => {
    const warned = await systemdUnitBuilderTool.run({
      fields: { ...defaults, execStart: '/usr/bin/a | b' },
      text: '',
    });

    assert.match(
      warned.summary ?? '',
      /no environment variables · ExecStart is not run by a shell/,
    );

    await assert.rejects(
      async () =>
        systemdUnitBuilderTool.run({ fields: { ...defaults, execStart: 'node app.js' }, text: '' }),
      ToolError,
    );
  });
});

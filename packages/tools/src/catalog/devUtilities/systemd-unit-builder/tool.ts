import type { ToolDefinition, ToolField } from '@devtoolora/core';
import { buildSystemdUnit, type SystemdUnitOptions } from '@devtoolora/functions/dev';
import { encodeBase64Text } from '@devtoolora/functions/encoding';
import { withToolError } from '../../../adapters/errors';
import { booleanField, choiceField, rangeField, rangedNumber } from '../../../adapters/fields';

const scopes = ['system', 'user'] as const;
const types = ['simple', 'exec', 'forking', 'oneshot', 'notify'] as const;
const restarts = ['no', 'on-failure', 'on-abnormal', 'always'] as const;

const systemOnly = { field: 'scope', is: ['system'] };
const restartSecField = rangeField({
  defaultValue: '5',
  id: 'restartSec',
  label: 'RestartSec',
  max: 3_600,
  min: 0,
  unit: 's',
  visibleWhen: { field: 'restart', isNot: ['no'] },
});

const fields: ToolField[] = [
  { defaultValue: 'myapp', id: 'unitName', label: 'Unit name', type: 'text' },
  { defaultValue: 'My app', id: 'description', label: 'Description', type: 'text' },
  {
    id: 'execStart',
    label: 'ExecStart',
    placeholder: '/usr/bin/node /srv/myapp/server.js',
    required: true,
    rows: 2,
    type: 'textarea',
  },
  { id: 'workingDirectory', label: 'WorkingDirectory', placeholder: '/srv/myapp', type: 'text' },
  {
    defaultValue: 'system',
    id: 'scope',
    label: 'Scope',
    options: [
      { label: 'System', value: 'system' },
      { label: 'User', value: 'user' },
    ],
    presentation: 'segmented',
    type: 'select',
  },
  { id: 'user', label: 'User', type: 'text', visibleWhen: systemOnly },
  { id: 'group', label: 'Group', type: 'text', visibleWhen: systemOnly },
  {
    defaultValue: 'simple',
    id: 'type',
    label: 'Type',
    options: types.map((value) => ({ label: value, value })),
    type: 'select',
  },
  {
    defaultValue: 'on-failure',
    id: 'restart',
    label: 'Restart',
    options: restarts.map((value) => ({ label: value, value })),
    type: 'select',
  },
  restartSecField,
  {
    id: 'environment',
    label: 'Environment',
    placeholder: 'NODE_ENV=production',
    rows: 4,
    sensitive: true,
    type: 'textarea',
  },
  { id: 'environmentFile', label: 'EnvironmentFile', placeholder: '-/etc/myapp.env', type: 'text' },
  {
    defaultValue: 'true',
    id: 'networkOnline',
    label: 'Wait for network',
    type: 'checkbox',
    visibleWhen: systemOnly,
  },
  {
    defaultValue: 'true',
    id: 'hardening',
    label: 'Hardening',
    type: 'checkbox',
    visibleWhen: systemOnly,
  },
];

const plural = (count: number): string =>
  count === 0
    ? 'no environment variables'
    : `${count} environment variable${count === 1 ? '' : 's'}`;

const sample = (label: string, values: Record<string, string>) => ({ fields: values, label });

export const systemdUnitBuilderTool: ToolDefinition = {
  autoRun: true,
  capabilities: ['browserWorker', 'browserMain', 'vscode', 'desktop'],
  category: 'Dev Utilities',
  description:
    'Write a systemd .service unit file with ExecStart, restart policy, environment, user and hardening options, with every value quoted safely.',
  fields,
  freshResults: true,
  id: 'systemd-unit-builder',
  inputKind: 'none',
  keywords: ['systemd', 'service unit', 'systemctl', 'unit file', 'daemon', 'linux service'],
  name: 'systemd Service Unit Builder',
  outputKind: 'text',
  relatedToolIds: ['docker-to-compose', 'cron-explain', 'editorconfig-generator'],
  resultActions: ['copy', 'scratch', 'save'],
  run: ({ fields: values }) =>
    withToolError(() => {
      const restart = choiceField(
        values.restart,
        'on-failure',
        restarts,
        'Choose a listed Restart value.',
      );
      const options: SystemdUnitOptions = {
        description: values.description ?? 'My app',
        environment: values.environment ?? '',
        environmentFile: values.environmentFile ?? '',
        execStart: values.execStart ?? '',
        group: values.group ?? '',
        hardening: booleanField(values.hardening, true),
        networkOnline: booleanField(values.networkOnline, true),
        restart,
        restartSec: restart === 'no' ? 0 : rangedNumber(restartSecField, values),
        scope: choiceField(values.scope, 'system', scopes, 'Choose System or User.'),
        type: choiceField(values.type, 'simple', types, 'Choose a listed Type.'),
        unitName: values.unitName ?? 'myapp',
        user: values.user ?? '',
        workingDirectory: values.workingDirectory ?? '',
      };
      const { environmentCount, fileName, text, warnings } = buildSystemdUnit(options);

      return {
        artifact: {
          base64: encodeBase64Text(text),
          fileName,
          mimeType: 'text/plain;charset=utf-8',
        },
        language: 'ini',
        noWrap: true,
        summary: [
          `${fileName} · ${options.scope} unit · ${plural(environmentCount)}`,
          ...warnings,
        ].join(' · '),
        text,
      };
    }),
  samples: [
    sample('Web app with environment', {
      environment: 'NODE_ENV=production\nPORT=8080',
      execStart: '/usr/bin/node /srv/myapp/server.js',
      user: 'myapp',
      workingDirectory: '/srv/myapp',
    }),
    sample('User-scope script', {
      description: 'Dev server',
      execStart: '/usr/bin/python3 -m http.server 8000',
      restart: 'no',
      scope: 'user',
      unitName: 'devserver',
    }),
    sample('Oneshot backup', {
      description: 'Nightly backup',
      execStart: '/usr/local/bin/backup.sh --full',
      restart: 'no',
      type: 'oneshot',
      unitName: 'backup',
    }),
    sample('Worker that always restarts', {
      environmentFile: '-/etc/myapp.env',
      execStart: '/usr/local/bin/worker --queue default',
      restart: 'always',
      restartSec: '10',
      unitName: 'worker',
      user: 'worker',
    }),
    sample('Notify daemon with group', {
      execStart: '/usr/sbin/mydaemon --foreground',
      group: 'mydaemon',
      type: 'notify',
      unitName: 'mydaemon',
      user: 'mydaemon',
    }),
    sample('ExecStart with a pipe', {
      execStart: '/usr/bin/tail -f /var/log/syslog | /usr/bin/grep error',
      unitName: 'logwatch',
    }),
  ],
  supportsSelection: false,
};

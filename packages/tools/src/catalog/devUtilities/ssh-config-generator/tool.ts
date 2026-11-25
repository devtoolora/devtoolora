import type { ToolDefinition, ToolField } from '@devtoolora/core';
import { buildSshConfig, type SshConfigOptions } from '@devtoolora/functions/dev';
import { encodeBase64Text } from '@devtoolora/functions/encoding';
import { withToolError } from '../../../adapters/errors';
import { booleanField, choiceField, rangeField } from '../../../adapters/fields';

const agentChoices = ['omit', 'yes', 'no', 'ask', 'confirm'] as const;
const strictChoices = ['omit', 'yes', 'accept-new', 'ask'] as const;

const choiceOptions = (values: readonly string[]) =>
  values.map((value) => ({ label: value === 'omit' ? 'Not set' : value, value }));

const fields: ToolField[] = [
  { id: 'host', label: 'Host', placeholder: 'prod', required: true, type: 'text' },
  { id: 'hostName', label: 'HostName', placeholder: '203.0.113.10', type: 'text' },
  { id: 'user', label: 'User', placeholder: 'deploy', type: 'text' },
  { id: 'port', label: 'Port', range: { max: 65_535, min: 1 }, type: 'number' },
  { id: 'identityFile', label: 'IdentityFile', placeholder: '~/.ssh/id_ed25519', type: 'text' },
  {
    defaultValue: 'true',
    id: 'identitiesOnly',
    label: 'IdentitiesOnly',
    type: 'checkbox',
    visibleWhen: { field: 'identityFile', isNot: [''] },
  },
  {
    id: 'proxyJump',
    label: 'ProxyJump',
    placeholder: 'jump@bastion.example.com:2200',
    type: 'text',
  },
  { defaultValue: 'false', id: 'forwardAgent', label: 'ForwardAgent', type: 'checkbox' },
  {
    defaultValue: 'omit',
    id: 'addKeysToAgent',
    label: 'AddKeysToAgent',
    options: choiceOptions(agentChoices),
    type: 'select',
  },
  { defaultValue: 'false', id: 'useKeychain', label: 'UseKeychain (macOS)', type: 'checkbox' },
  rangeField({
    defaultValue: '0',
    id: 'serverAliveInterval',
    label: 'ServerAliveInterval',
    max: 86_400,
    min: 0,
    unit: 's',
  }),
  {
    defaultValue: 'omit',
    id: 'strictHostKeyChecking',
    label: 'StrictHostKeyChecking',
    options: choiceOptions(strictChoices),
    type: 'select',
  },
  {
    id: 'localForward',
    label: 'LocalForward',
    placeholder: '5432 db.internal:5432',
    rows: 3,
    type: 'textarea',
  },
];

const sample = (label: string, values: Record<string, string>) => ({ fields: values, label });

export const sshConfigGeneratorTool: ToolDefinition = {
  autoRun: true,
  capabilities: ['browserWorker', 'browserMain', 'vscode', 'desktop'],
  category: 'Dev Utilities',
  description:
    'Write one ssh_config Host block with HostName, User, Port, IdentityFile, ProxyJump, agent and keep-alive options and port forwards, validated before it is quoted.',
  fields,
  freshResults: true,
  id: 'ssh-config-generator',
  inputKind: 'none',
  keywords: [
    'ssh config',
    '~/.ssh/config',
    'proxyjump',
    'bastion',
    'identityfile',
    'ssh host alias',
  ],
  name: 'SSH Config Generator',
  outputKind: 'text',
  relatedToolIds: ['ssh-key-generator', 'systemd-unit-builder', 'ipv6-converter'],
  resultActions: ['copy', 'scratch', 'save'],
  run: ({ fields: values }) =>
    withToolError(() => {
      const options: SshConfigOptions = {
        addKeysToAgent: choiceField(
          values.addKeysToAgent,
          'omit',
          agentChoices,
          'Choose a listed AddKeysToAgent value.',
        ),
        forwardAgent: booleanField(values.forwardAgent, false),
        host: values.host ?? '',
        hostName: values.hostName ?? '',
        identitiesOnly: booleanField(values.identitiesOnly, true),
        identityFile: values.identityFile ?? '',
        localForward: values.localForward ?? '',
        port: values.port ?? '',
        proxyJump: values.proxyJump ?? '',
        serverAliveInterval: values.serverAliveInterval ?? '0',
        strictHostKeyChecking: choiceField(
          values.strictHostKeyChecking,
          'omit',
          strictChoices,
          'Choose a listed StrictHostKeyChecking value.',
        ),
        useKeychain: booleanField(values.useKeychain, false),
        user: values.user ?? '',
      };
      const { optionCount, text } = buildSshConfig(options);
      const hostLine = text.split('\n')[0]?.slice('Host '.length) ?? '';

      return {
        artifact: {
          base64: encodeBase64Text(text),
          fileName: 'ssh_config',
          mimeType: 'text/plain;charset=utf-8',
        },
        language: 'ini',
        noWrap: true,
        summary: `Host ${hostLine} · ${optionCount} option${optionCount === 1 ? '' : 's'}`,
        text,
      };
    }),
  samples: [
    sample('Server with a key', {
      host: 'prod',
      hostName: '203.0.113.10',
      identityFile: '~/.ssh/id_ed25519',
      port: '2222',
      user: 'deploy',
    }),
    sample('Host behind a bastion', {
      host: 'internal',
      hostName: '10.0.0.5',
      proxyJump: 'jump@bastion.example.com:2200',
      user: 'ops',
    }),
    sample('IPv6 host', { host: 'v6box', hostName: '2001:db8::10', user: 'admin' }),
    sample('Keychain and agent on macOS', {
      addKeysToAgent: 'yes',
      host: 'github.com',
      identityFile: '~/.ssh/id_ed25519',
      useKeychain: 'true',
      user: 'git',
    }),
    sample('Port forward to a database', {
      host: 'db',
      hostName: 'db.example.com',
      localForward: '5432 db.internal:5432',
      serverAliveInterval: '60',
      user: 'deploy',
    }),
    sample('Wildcard pattern with defaults', {
      host: 'prod-*',
      serverAliveInterval: '30',
      strictHostKeyChecking: 'accept-new',
      user: 'deploy',
    }),
  ],
  supportsSelection: false,
};

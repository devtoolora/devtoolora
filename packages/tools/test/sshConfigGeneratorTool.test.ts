import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { sshConfigGeneratorTool } from '../src/catalog/devUtilities';
import { fieldsOf } from './tools.helpers';

const defaults = Object.fromEntries(
  (sshConfigGeneratorTool.fields ?? []).map((field) => [field.id, field.defaultValue ?? '']),
);

describe('ssh config generator tool', () => {
  it('declares its fields', () => {
    assert.equal(sshConfigGeneratorTool.id, 'ssh-config-generator');
    assert.equal(sshConfigGeneratorTool.inputKind, 'none');
    assert.equal(sshConfigGeneratorTool.autoRun, true);
    assert.equal(sshConfigGeneratorTool.freshResults, true);
    assert.deepEqual(sshConfigGeneratorTool.resultActions, ['copy', 'scratch', 'save']);

    assert.deepEqual(
      sshConfigGeneratorTool.fields?.map(({ defaultValue, id, type }) => [id, type, defaultValue]),
      [
        ['host', 'text', undefined],
        ['hostName', 'text', undefined],
        ['user', 'text', undefined],
        ['port', 'number', undefined],
        ['identityFile', 'text', undefined],
        ['identitiesOnly', 'checkbox', 'true'],
        ['proxyJump', 'text', undefined],
        ['forwardAgent', 'checkbox', 'false'],
        ['addKeysToAgent', 'select', 'omit'],
        ['useKeychain', 'checkbox', 'false'],
        ['serverAliveInterval', 'number', '0'],
        ['strictHostKeyChecking', 'select', 'omit'],
        ['localForward', 'textarea', undefined],
      ],
    );

    const field = (id: string) =>
      fieldsOf(sshConfigGeneratorTool)?.find((entry) => entry.id === id);

    assert.equal(field('host')?.required, true);

    assert.deepEqual(field('identitiesOnly')?.visibleWhen, {
      field: 'identityFile',
      isNot: [''],
    });

    assert.equal(
      field('strictHostKeyChecking')?.options?.some((option) => option.value === 'no'),
      false,
    );
  });

  it('writes the host block and its artifact', async () => {
    const result = await sshConfigGeneratorTool.run({
      fields: {
        ...defaults,
        host: 'prod',
        hostName: '203.0.113.10',
        identityFile: '~/.ssh/id_ed25519',
        port: '2222',
        user: 'deploy',
      },
      text: '',
    });

    assert.equal(result.summary, 'Host prod · 5 options');
    assert.equal(result.artifact?.fileName, 'ssh_config');

    assert.equal(
      Buffer.from(result.artifact?.base64 ?? '', 'base64').toString('utf8'),
      result.text,
    );

    assert.match(result.text ?? '', /^Host prod\n {2}HostName 203\.0\.113\.10\n/);
  });
});

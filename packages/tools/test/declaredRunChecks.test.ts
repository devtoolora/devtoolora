import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import {
  canRunTool,
  isToolFieldHidden,
  isToolFileMode,
  isToolInputHidden,
  type ToolDefinition,
} from '@devtoolora/core';
import { domainTools } from '../src/catalog';

const allTools: ToolDefinition[] = Object.values(domainTools).flat();

function tool(id: string): ToolDefinition {
  const found = allTools.find((candidate) => candidate.id === id);

  if (!found) throw new Error(`Missing tool ${id}`);

  return found;
}

function seededFields(
  definition: ToolDefinition,
  overrides: Record<string, string>,
): Record<string, string> {
  const defaults = Object.fromEntries(
    (definition.fields ?? []).map((field) => [field.id, field.defaultValue ?? '']),
  );

  return { ...defaults, ...overrides };
}

const file = 'data:text/plain;base64,aGk=';
const cert = '-----BEGIN CERTIFICATE-----';

describe('declared run checks on real definitions', () => {
  it.each([
    ['svg-to-png', '', { file }, true],
    ['svg-to-png', '<svg/>', {}, true],
    ['svg-to-png', '', {}, false],
    ['pixel-diff', '', { afterImage: file, beforeImage: file }, true],
    ['pixel-diff', '', { beforeImage: file }, false],
    ['json-diff', '', { left: '{}', right: '{}' }, true],
    ['json-diff', '', { left: '{}', right: '  ' }, false],
    ['semver-compare', '', { left: '1.0.0', right: '1.0.1' }, true],
    ['semver-compare', '', { left: '1.0.0' }, false],
    ['financial-calculator', '', { principal: '1000', rate: '5', years: '3' }, true],
    ['financial-calculator', '', { principal: '1000', rate: '5', years: '' }, false],
    ['unit-converter', '', { value: '5' }, true],
    ['unit-converter', '', { value: '' }, false],
    ['web-pwa-icon-generator', '', { sourceMode: 'image' }, false],
    ['web-pwa-icon-generator', '', { image: file, sourceMode: 'image' }, true],
    ['web-pwa-icon-generator', '', { appName: 'App', sourceMode: 'text', textLabel: 'A' }, true],
    ['web-pwa-icon-generator', '', { appName: '', sourceMode: 'text', textLabel: '' }, false],
    ['password-strength', '', { password: '     ' }, true],
    ['password-strength', '', { password: '' }, false],
    ['hmac', 'message', { secret: '   ' }, true],
    ['pbkdf2', '', { password: '   ' }, true],
    ['bcrypt-hash', '', { password: '   ' }, true],
    ['argon2-hash', '', { password: '   ' }, true],
    ['aes-encrypt', 'message', { mode: 'encrypt', passphrase: '   ' }, true],
    ['basic-auth', '', { password: '   ', username: 'demo' }, true],
    ['basic-auth', '', { password: 'demo', username: '   ' }, false],
    ['certificate-inspector', cert, {}, true],
    ['certificate-inspector', '', { certificateFile: file }, true],
    ['certificate-inspector', '', {}, false],
    ['pem-key-inspector', cert, {}, true],
    ['pem-key-inspector', '', { keyFile: file }, true],
    ['pem-key-inspector', '', {}, false],
    ['base64-encode', '', { file, inputType: 'file', mode: 'encode' }, true],
    ['base64-encode', '', { file: '', inputType: 'file', mode: 'encode' }, false],
    ['base64-encode', 'SGk=', { file, inputType: 'file', mode: 'decode' }, true],
  ] as Array<[string, string, Record<string, string>, boolean]>)(
    '%s with text %j and %j: canRun %s',
    (id, text, overrides, expected) => {
      const definition = tool(id);

      assert.equal(canRunTool(definition, text, seededFields(definition, overrides)), expected);
    },
  );

  it.each([
    ['hmac', 'message', { secret: '   ' }],
    ['pbkdf2', '', { iterations: '1', password: '   ' }],
    ['bcrypt-hash', '', { cost: '4', password: '   ' }],
    ['aes-encrypt', 'message', { iterations: '1000', mode: 'encrypt', passphrase: '   ' }],
    ['basic-auth', '', { password: '   ', username: 'demo' }],
    ['password-strength', '', { password: '   ' }],
  ] as Array<[string, string, Record<string, string>]>)(
    '%s runs on a password of only spaces',
    async (id, text, overrides) => {
      const definition = tool(id);
      const result = await definition.run({ fields: seededFields(definition, overrides), text });

      assert.ok(result.text);
    },
  );

  it('keeps the Base64 text input visible while decoding a file and marks file mode', () => {
    const definition = tool('base64-encode');
    const decode = seededFields(definition, { inputType: 'file', mode: 'decode' });
    const encode = seededFields(definition, { inputType: 'file', mode: 'encode' });

    assert.equal(isToolInputHidden(definition, decode), false);
    assert.equal(isToolFileMode(definition, decode), true);
    assert.equal(isToolInputHidden(definition, encode), true);
    assert.equal(isToolFileMode(definition, encode), true);
    assert.equal(isToolFieldHidden(definition, 'alphabet', seededFields(definition, {})), false);
  });
});

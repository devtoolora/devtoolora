import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { vscodeToolMetadata } from '../src/extension/toolMetadata.generated';
import { draftFromInputs } from '../src/webview/client/utils/state';

const tool = (id: string) => {
  const found = vscodeToolMetadata.find((candidate) => candidate.id === id);

  if (!found) throw new Error(`Missing tool ${id}`);

  return found;
};

describe('draftFromInputs', () => {
  it('drops file, password and sensitive fields and their file names', () => {
    const draft = draftFromInputs(tool('basic-auth'), '', {
      password: 'secret',
      username: ' demo ',
    });

    assert.deepEqual(draft, { fields: { username: ' demo ' }, input: '' });
    const base64 = draftFromInputs(tool('base64-encode'), 'hello', {
      file: 'data:text/plain;base64,aGk=',
      fileName: 'hi.txt',
      inputType: 'text',
      mode: 'encode',
    });

    assert.deepEqual(base64?.fields, { inputType: 'text', mode: 'encode' });
    assert.equal(base64?.input, 'hello');
  });

  it('stores no input text for Base64 file mode and sensitive-input tools', () => {
    const base64 = draftFromInputs(tool('base64-encode'), '/w==', {
      inputType: 'file',
      mode: 'decode',
    });

    assert.deepEqual(base64, { fields: { inputType: 'file', mode: 'decode' }, input: '' });
    const sensitive = vscodeToolMetadata.find((candidate) => candidate.sensitiveInput);

    assert.ok(sensitive, 'a sensitive-input tool exists');

    assert.deepEqual(draftFromInputs(sensitive, 'eyJhbGciOi...', { extra: 'x' }), {
      fields: { extra: 'x' },
      input: '',
    });
  });

  it('stores no input text while the main input is hidden', () => {
    const hidden = {
      ...tool('base64-encode'),
      fileModeWhen: undefined,
      inputVisibleWhen: { field: 'mode', is: ['decode'] },
    };

    assert.equal(
      draftFromInputs(hidden, 'stale', { alphabet: 'url-safe', mode: 'encode' })?.input,
      '',
    );

    assert.equal(
      draftFromInputs(hidden, 'kept', { alphabet: 'url-safe', mode: 'decode' })?.input,
      'kept',
    );
  });

  it('returns no draft when the inputs equal the defaults', () => {
    const defaults = Object.fromEntries(
      (tool('slugify').fields ?? []).map((field) => [field.id, field.defaultValue ?? '']),
    );

    assert.equal(draftFromInputs(tool('slugify'), '', defaults), undefined);

    assert.deepEqual(draftFromInputs(tool('slugify'), '', { ...defaults, separator: '_' }), {
      fields: { ...defaults, separator: '_' },
      input: '',
    });
  });
});

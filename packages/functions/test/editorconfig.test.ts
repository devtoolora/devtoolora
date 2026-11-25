import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { generateEditorconfig, type EditorconfigOptions } from '../src/dev';

describe('editorconfig generator', () => {
  const base: EditorconfigOptions = {
    charset: 'utf-8',
    endOfLine: 'lf',
    indentSize: 2,
    indentStyle: 'space',
    insertFinalNewline: 'true',
    root: true,
    sections: [],
    trimTrailingWhitespace: 'true',
  };

  it('writes root and the [*] section', () => {
    assert.deepEqual(generateEditorconfig(base), {
      properties: 6,
      sections: 1,
      text: 'root = true\n\n[*]\nindent_style = space\nindent_size = 2\nend_of_line = lf\ncharset = utf-8\ntrim_trailing_whitespace = true\ninsert_final_newline = true\n',
    });

    assert.equal(
      generateEditorconfig({ ...base, charset: 'omit', endOfLine: 'omit', root: false }).text,
      '[*]\nindent_style = space\nindent_size = 2\ntrim_trailing_whitespace = true\ninsert_final_newline = true\n',
    );
  });

  it('adds fixed sections in a stable order', () => {
    const none = {
      ...base,
      charset: 'omit',
      endOfLine: 'omit',
      indentSize: 'omit',
      indentStyle: 'omit',
      insertFinalNewline: 'omit',
      root: false,
      trimTrailingWhitespace: 'omit',
    } as const;

    assert.equal(
      generateEditorconfig({
        ...none,
        sections: ['windows', 'yaml', 'python', 'go', 'makefile', 'markdown'],
      }).text,
      '[*.md]\ntrim_trailing_whitespace = false\n\n[Makefile]\nindent_style = tab\n\n[*.go]\nindent_style = tab\n\n[*.py]\nindent_style = space\nindent_size = 4\n\n[*.{yml,yaml}]\nindent_style = space\nindent_size = 2\n\n[*.{bat,cmd,ps1}]\nend_of_line = crlf\n',
    );

    assert.throws(() => generateEditorconfig(none), { message: 'Choose at least one setting.' });

    assert.throws(() => generateEditorconfig({ ...base, indentSize: 17 }), {
      message: 'Indent size must be 1-16.',
    });
  });
});

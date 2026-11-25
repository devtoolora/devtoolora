import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { convertDotenv, parseDotenv, redactDotenv } from '../src/config';

const redactKeepingComments = (text: string): string => redactDotenv(parseDotenv(text), '', false);
const example = (text: string): string => convertDotenv(text, 'example').text;

describe('dotenv values next to a hash', () => {
  it('does not leak the end of a redacted value as a comment', () => {
    for (const [source, expected] of [
      ['DB_PASSWORD=abc#def\n', 'DB_PASSWORD=<redacted>\n'],
      ['DB_PASSWORD=#abc\n', 'DB_PASSWORD=<redacted>\n'],
      ['DB_PASSWORD="abc"#def\n', 'DB_PASSWORD=<redacted>\n'],
      ['DB_PASSWORD=abc#def # note\n', 'DB_PASSWORD=<redacted>\n'],
      ['DB_PASSWORD=abc # note\n', 'DB_PASSWORD=<redacted> # note\n'],
      ['DB_PASSWORD="abc" # note\n', 'DB_PASSWORD=<redacted> # note\n'],
      ['PORT=3000#note\n', 'PORT=3000 # note\n'],
    ] as const) {
      assert.equal(redactKeepingComments(source), expected, source);
    }
  });

  it('does not leak the end of a blanked value into .env.example', () => {
    assert.equal(example('DB_PASSWORD=abc#def\n'), 'DB_PASSWORD=\n');
    assert.equal(example('PORT=3000# development\n'), 'PORT=\n');
    assert.equal(example('A="abc"#def\n'), 'A=\n');
    assert.equal(example('DB_PASSWORD=abc # note\n'), 'DB_PASSWORD= # note\n');
  });
});

describe('dotenv values converted from JSON', () => {
  const toEnv = (json: string): string => convertDotenv(json, 'json-to-env').text;

  it('keeps the digits of numbers as written', () => {
    assert.equal(toEnv('{"A":12345678901234567890}'), 'A=12345678901234567890\n');
    assert.equal(toEnv('{"A":1.10,"B":-0.5,"C":1e3}'), 'A=1.10\nB=-0.5\nC=1e3\n');
  });

  it('still rejects what it rejected, without echoing values', () => {
    assert.throws(() => toEnv('{"A":{"B":1}}'), /Value of "A" is an object/);
    assert.throws(() => toEnv('{"A":[1]}'), /Value of "A" is an array/);
    assert.throws(() => toEnv('[1]'), /must be an object/);
    assert.throws(() => toEnv('5'), /must be an object/);
    assert.throws(() => toEnv('{"A":secret}'), { message: 'Input is not valid JSON.' });
    assert.throws(() => toEnv(''), { message: 'Input is not valid JSON.' });
  });

  it('keeps the last value of a repeated key and warns about it', () => {
    const result = convertDotenv('{"A":"one",\n"A":"two"}', 'json-to-env');

    assert.equal(result.text, 'A=two\n');
    assert.equal(result.warning, 'Duplicate key "A" at line 2; only its last value is kept.');
    assert.equal(convertDotenv('{"A":"one"}', 'json-to-env').warning, undefined);
  });

  it('single-quotes a dollar sign so that sh does not expand it', () => {
    assert.equal(toEnv('{"C":"$HOME","D":"pa$word x"}'), "C='$HOME'\nD='pa$word x'\n");

    assert.deepEqual(JSON.parse(convertDotenv(toEnv('{"C":"$HOME"}'), 'env-to-json').text), {
      C: '$HOME',
    });

    assert.equal(toEnv('{"E":"it\'s $5"}'), 'E="it\'s $5"\n');
  });
});

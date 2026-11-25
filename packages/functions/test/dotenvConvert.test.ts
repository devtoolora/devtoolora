import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { convertDotenv } from '../src/config/dotenvConvert';

const env =
  'PORT=3000\nexport DEBUG=false\nMSG="hello world" # greet\n\n# db\nDB_URL=postgres://u:p@h/db\n';

describe('convertDotenv', () => {
  it('converts .env to JSON and YAML in file order', () => {
    const json = convertDotenv(env, 'env-to-json');

    assert.equal(
      json.text,
      '{\n  "PORT": "3000",\n  "DEBUG": "false",\n  "MSG": "hello world",\n  "DB_URL": "postgres://u:p@h/db"\n}',
    );

    assert.equal(json.variables, 4);

    assert.equal(
      convertDotenv(env, 'env-to-yaml').text,
      'PORT: "3000"\nDEBUG: "false"\nMSG: hello world\nDB_URL: postgres://u:p@h/db\n',
    );
  });

  it('warns when a # touching a value was read as a comment', () => {
    const result = convertDotenv('DB_PASSWORD=abc#def\nPORT=3000 # dev\n', 'env-to-json');

    assert.equal(result.text, '{\n  "DB_PASSWORD": "abc",\n  "PORT": "3000"\n}');
    assert.match(result.warning ?? '', /^1 # without a space before it was read as a comment;/);
    assert.equal(convertDotenv(env, 'env-to-yaml').warning, undefined);
  });

  it('converts JSON and YAML to .env', () => {
    assert.equal(
      convertDotenv(
        '{"PORT":3000,"MSG":"hello world","EMPTY":null,"FLAG":true,"HASH":"a#b","Q":"say \\"hi\\"","NL":"a\\nb"}',
        'json-to-env',
      ).text,
      'PORT=3000\nMSG="hello world"\nEMPTY=\nFLAG=true\nHASH="a#b"\nQ="say \\"hi\\""\nNL="a\\nb"\n',
    );

    assert.equal(
      convertDotenv('PORT: 3000\nNAME: app\n', 'yaml-to-env').text,
      'PORT=3000\nNAME=app\n',
    );
  });

  it('generates an example file', () => {
    assert.equal(
      convertDotenv(env, 'example').text,
      'PORT=\nexport DEBUG=\nMSG= # greet\n\n# db\nDB_URL=\n',
    );

    assert.equal(
      convertDotenv(env, 'example', { placeholder: '<value>' }).text.split('\n')[0],
      'PORT=<value>',
    );

    assert.equal(
      convertDotenv(env, 'example', { keepComments: false }).text,
      'PORT=\nexport DEBUG=\nMSG=\n\nDB_URL=\n',
    );
  });

  it('rejects bad input without echoing raw parser messages', () => {
    const run = (text: string, mode: Parameters<typeof convertDotenv>[1]) => () =>
      convertDotenv(text, mode);

    assert.throws(
      run('{"db":{"host":"x"}}', 'json-to-env'),
      /Value of "db" is an object; flatten nested values first \(JSON Flattener\)\./,
    );

    assert.throws(run('{"a":[1]}', 'json-to-env'), /Value of "a" is an array; flatten/);
    assert.throws(run('{"a-b":1}', 'json-to-env'), /Key "a-b" is not a valid variable name\./);
    assert.throws(run('[1]', 'json-to-env'), /Input must be an object of variables\./);
    assert.throws(run('PORT=1\nPORT=2\n', 'env-to-json'), /Duplicate variable "PORT" on line 2\./);

    assert.throws(run('x', 'json-to-env'), /Input is not valid JSON\./);

    assert.throws(run('a: [', 'yaml-to-env'), /Input is not valid YAML\./);
    assert.throws(run('PORT', 'env-to-json'), /Invalid \.env input/);
  });

  it('limits the number of variables', () => {
    const big = JSON.stringify(
      Object.fromEntries(Array.from({ length: 10_001 }, (_, i) => [`K${i}`, 1])),
    );

    assert.throws(() => convertDotenv(big, 'json-to-env'), /Input exceeds 10,000 variables\./);
  });

  it('round-trips escaped values and keeps other quoting verbatim', () => {
    const object = { BS: 'C:\\dir', NL: 'a\nb', Q: 'say "hi"' };
    const back = convertDotenv(JSON.stringify(object), 'json-to-env').text;

    assert.deepEqual(JSON.parse(convertDotenv(back, 'env-to-json').text), object);

    assert.deepEqual(JSON.parse(convertDotenv('PATH=C:\\dir\n', 'env-to-json').text), {
      PATH: 'C:\\dir',
    });

    assert.deepEqual(JSON.parse(convertDotenv("S='a\\nb'\n", 'env-to-json').text), {
      S: 'a\\nb',
    });

    assert.throws(
      () => convertDotenv(' '.repeat(1_048_577), 'json-to-env'),
      /Input exceeds 1,048,576 characters\./,
    );
  });

  it('quotes values containing a dollar sign', () => {
    assert.equal(convertDotenv('{"PRICE":"$5"}', 'json-to-env').text.trim(), "PRICE='$5'");
  });

  it('quotes example placeholders like real values', () => {
    assert.equal(
      convertDotenv('A=1\n', 'example', { placeholder: 'CHANGE ME' }).text,
      'A="CHANGE ME"\n',
    );

    assert.equal(convertDotenv('A=1\n', 'example', { placeholder: 'x\ny' }).text, 'A="x\\ny"\n');
  });

  it('limits .env input to 10,000 variables', () => {
    const many = Array.from({ length: 10_001 }, (_, i) => `K${i}=1`).join('\n');

    assert.throws(() => convertDotenv(many, 'env-to-json'), /10,000 variables/);
  });

  it('enforces the variable limit at the boundary in every mode', () => {
    const envOf = (count: number) => Array.from({ length: count }, (_, i) => `K${i}=1`).join('\n');
    const jsonOf = (count: number) =>
      JSON.stringify(Object.fromEntries(Array.from({ length: count }, (_, i) => [`K${i}`, 1])));

    for (const mode of ['env-to-json', 'env-to-yaml', 'example'] as const) {
      assert.equal(convertDotenv(envOf(10_000), mode).variables, 10_000);
      assert.throws(() => convertDotenv(envOf(10_001), mode), /10,000 variables/);
    }

    assert.equal(convertDotenv(jsonOf(10_000), 'json-to-env').variables, 10_000);
    assert.throws(() => convertDotenv(jsonOf(10_001), 'json-to-env'), /10,000 variables/);
  });

  it('detects duplicates by exact key and quotes tricky placeholders', () => {
    assert.equal(convertDotenv('A=1\nAB=2\n', 'env-to-json').variables, 2);
    assert.throws(() => convertDotenv('AB=1\nA=2\nAB=3\n', 'env-to-json'), /"AB" on line 3/);

    for (const placeholder of ['a"b', 'a\\b', 'a#b']) {
      const out = convertDotenv('A=1\n', 'example', { placeholder }).text;

      assert.ok(out.startsWith('A="') && out.split('\n').length === 2, placeholder);
    }
  });

  it('bounds duplicate diagnostics and words them the same in every mode', () => {
    const many = Array.from({ length: 1000 }, () => 'A=1').join('\n');

    assert.throws(() => convertDotenv('A=1\nA=2\n', 'example'), {
      message: 'Duplicate variable "A" on line 2.',
    });

    for (const mode of ['env-to-json', 'example'] as const)
      assert.throws(() => convertDotenv(many, mode), /Duplicate variable "A" on line 2\./);

    assert.throws(
      () => convertDotenv(`${many}\nbad`, 'env-to-json'),
      (error: unknown) =>
        error instanceof Error &&
        error.message.length < 2000 &&
        error.message.endsWith('… and 980 more issues.'),
    );
  });
});

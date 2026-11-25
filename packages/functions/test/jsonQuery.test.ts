import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { queryJsonDocument } from '@devtoolora/functions/format';
import { FunctionError } from '@devtoolora/functions/errors';

describe('precise JSON selectors', () => {
  it('supports named paths, indexes, quoted keys and copied JSON Pointers', () => {
    const source =
      '{"users":[{"name":"Ada","id":9007199254740993}],"a.b":{"a/b~c":{"":1.00}},"~1":false}';

    for (const path of ['$.users[0].id', 'users.0.id', "$['users'][0]['id']"]) {
      assert.deepEqual(queryJsonDocument(source, path), {
        pointer: '/users/0/id',
        text: '9007199254740993',
        type: 'number',
      });
    }

    assert.equal(queryJsonDocument(source, '/users/0/id', 'pointer').text, '9007199254740993');
    assert.equal(queryJsonDocument(source, '$["a.b"]["a/b~c"][""]').text, '1.00');
    assert.equal(queryJsonDocument(source, '/a.b/a~1b~0c/', 'pointer').text, '1.00');
    assert.equal(queryJsonDocument(source, '/~01', 'pointer').text, 'false');
    assert.equal(queryJsonDocument('{"it\'s":"x"}', "$['it\\'s']").text, '"x"');
    assert.equal(queryJsonDocument('{"a\\nb":1}', '/a\nb', 'pointer').text, '1');
    assert.equal(queryJsonDocument('{" spaced ":1}', '/ spaced ', 'pointer').text, '1');
  });

  it('retains complete selected structures, exact scalar spelling and all empty values', () => {
    const source =
      '{"value":{"id":9007199254740993,"same":1,"same":2,"escaped":"\\u0061"},"values":[null,false,0,"",[],{}]}';

    assert.match(queryJsonDocument(source, '$.value').text, /"id": 9007199254740993/);
    assert.match(queryJsonDocument(source, '$.value').text, /"same": 1,\n  "same": 2/);
    assert.match(queryJsonDocument(source, '$.value').text, /"escaped": "\\u0061"/);
    for (const [index, expected] of ['null', 'false', '0', '""', '[]', '{}'].entries())
      assert.equal(queryJsonDocument(source, `/values/${index}`, 'pointer').text, expected);
    assert.equal(queryJsonDocument('  null  ', '', 'pointer').text, 'null');
    assert.equal(queryJsonDocument('[]', '$').text, '[]');
    assert.equal(queryJsonDocument('{"":0}', '/', 'pointer').text, '0');
    assert.throws(() => queryJsonDocument(source, '$.value.same'), /Duplicate key/);
  });

  it('never traverses prototypes or silently guesses malformed paths', () => {
    for (const path of ['$.constructor', '$.__proto__', '$.toString'])
      assert.throws(
        () => queryJsonDocument('{}', path),
        (error: unknown) => error instanceof FunctionError && error.code === 'JSON_PATH_NOT_FOUND',
      );

    assert.equal(
      queryJsonDocument('{"__proto__":{"constructor":1}}', '$.__proto__.constructor').text,
      '1',
    );

    for (const path of [
      '$.x.',
      '$..x',
      '$.x[*]',
      '$.x[-1]',
      '$.x[01]',
      '$.x[0:2]',
      '$.x[?(@.id)]',
      '$["unclosed]',
      '$["bad\\x"]',
    ])
      assert.throws(() => queryJsonDocument('{"x":[]}', path), /Invalid simple path/);
    for (const path of ['#/x', ' /x', '/x~2', '/x~'])
      assert.throws(() => queryJsonDocument('{}', path, 'pointer'), /JSON Pointer/);
    for (const path of ['/01', '/-'])
      assert.throws(() => queryJsonDocument('[0,1]', path, 'pointer'), /Array index/);
    assert.equal(queryJsonDocument('{"01":1}', '/01', 'pointer').text, '1');
    assert.throws(() => queryJsonDocument('{}', 'x'.repeat(16_385)), /16,384/);
    assert.throws(() => queryJsonDocument('{}', ''), /required/);
  });

  it('accepts a bracket segment first without the $', () => {
    assert.equal(queryJsonDocument('[{"id":1}]', '[0].id').text, '1');
    assert.equal(queryJsonDocument('{"x y":1}', '["x y"]').text, '1');
    assert.equal(queryJsonDocument('{"x y":1}', "['x y']").text, '1');
    assert.throws(() => queryJsonDocument('{}', '[x]'), /Invalid simple path at offset 1/);
  });
});

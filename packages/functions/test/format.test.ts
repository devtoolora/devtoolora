import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import {
  csvToJson,
  formatSql,
  formatXml,
  jsonDocumentToCsv,
  jsonDocumentToToml,
  jsonDocumentToXml,
  jsonToYaml,
  parseJson,
  tomlDocumentToJson,
  xmlToJson,
  yamlToJson,
} from '@devtoolora/functions/format';
import { FunctionError } from '@devtoolora/functions/errors';

describe('format functions', () => {
  it('converts the supported YAML, XML, CSV, TOML, and SQL subsets', async () => {
    assert.match(jsonToYaml(parseJson('{"name":"Ada","items":[1,2]}')), /name: Ada/);
    assert.deepEqual(yamlToJson('name: Ada\nage: 37'), { name: 'Ada', age: 37 });

    assert.equal(
      formatXml('<root><child>ok</child></root>'),
      '<root>\n  <child>ok</child>\n</root>',
    );

    assert.match(await formatSql('select id,name from users where active = 1'), /^SELECT/);
    assert.match(jsonDocumentToXml('{"person":{"name":"Ada"}}'), /<person>/);
    assert.deepEqual(xmlToJson('<person><name>Ada</name></person>'), { person: { name: 'Ada' } });
    assert.equal(jsonDocumentToCsv('[{"name":"Ada","role":"admin"}]'), 'name,role\nAda,admin');
    assert.deepEqual(csvToJson('name,role\nAda,admin'), [{ name: 'Ada', role: 'admin' }]);

    assert.equal(jsonDocumentToToml('{"name":"demo","port":3000}'), 'name = "demo"\nport = 3000\n');

    assert.deepEqual(JSON.parse(tomlDocumentToJson('name = "demo"\nport = 3000').text), {
      name: 'demo',
      port: 3000,
    });
  });

  it('reports parse errors with a stable code', () => {
    assert.throws(
      () => parseJson('{'),
      (error: unknown) => error instanceof FunctionError && error.code === 'INVALID_JSON',
    );
  });
});

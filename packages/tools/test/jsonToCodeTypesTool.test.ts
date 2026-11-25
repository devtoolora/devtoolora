import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { ToolError } from '@devtoolora/core';
import {
  jsonToCodeTypesTool,
  jsonToCsharpTool,
  jsonToGoTool,
  jsonToJavaTool,
  jsonToKotlinTool,
  jsonToPythonTool,
  jsonToRustTool,
  jsonToSwiftTool,
} from '../src/catalog/schemaTypes/json-to-code-types/tool';

describe('json-to-code-types tool', () => {
  it('declares its identity, fields and samples', () => {
    assert.equal(jsonToCodeTypesTool.id, 'json-to-code-types');
    assert.equal(jsonToCodeTypesTool.name, 'JSON to Code Types');
    assert.equal(jsonToCodeTypesTool.category, 'Schema & Types');
    assert.equal(jsonToCodeTypesTool.inputKind, 'text');
    assert.equal(jsonToCodeTypesTool.outputKind, 'text');

    assert.deepEqual(
      jsonToCodeTypesTool.fields?.map((field) => [field.id, field.defaultValue]),
      [
        ['language', 'go'],
        ['rootName', 'Root'],
        ['optionalProperties', 'observed'],
        ['pythonFlavor', 'dataclass'],
      ],
    );

    assert.deepEqual(jsonToCodeTypesTool.relatedToolIds, [
      'json-to-typescript',
      'json-to-zod',
      'json-schema-generator',
    ]);

    assert.equal(jsonToCodeTypesTool.samples?.length, 6);
  });

  it('runs every sample', async () => {
    for (const sample of jsonToCodeTypesTool.samples ?? []) {
      const result = await jsonToCodeTypesTool.run({
        fields: sample.fields ?? {},
        text: sample.text ?? '',
      });

      assert.ok(result.text, sample.label);
      assert.match(result.summary ?? '', / · \d+ types?$/, sample.label);
    }
  });

  it('summarizes and names the artifact per language', async () => {
    const go = await jsonToCodeTypesTool.run({
      fields: { language: 'go' },
      text: '{"a":{"b":1}}',
    });
    const pydantic = await jsonToCodeTypesTool.run({
      fields: { language: 'python', pythonFlavor: 'pydantic' },
      text: '{"a":1}',
    });

    assert.equal(go.summary, 'Go · 2 types');
    assert.equal(go.artifact?.fileName, 'types.go');
    assert.equal(go.language, 'go');
    assert.equal(pydantic.summary, 'Python (Pydantic) · 1 type');
    assert.equal(pydantic.artifact?.fileName, 'types.py');
    assert.match(pydantic.text, /class Root\(BaseModel\):/);
  });

  it('rejects an unknown language and a scalar root', async () => {
    await assert.rejects(
      async () => jsonToCodeTypesTool.run({ fields: { language: 'cobol' }, text: '{}' }),
      (error) => error instanceof ToolError && error.message === 'Choose a language from the list.',
    );

    await assert.rejects(
      async () => jsonToCodeTypesTool.run({ fields: {}, text: '[1,2]' }),
      (error) =>
        error instanceof ToolError &&
        error.message === 'Code types need a JSON object or an array of objects as the root.',
    );
  });

  it('defines one alias per language', () => {
    const aliases = [
      [jsonToGoTool, 'json-to-go', 'JSON to Go Struct', 'go'],
      [jsonToRustTool, 'json-to-rust', 'JSON to Rust Struct', 'rust'],
      [jsonToKotlinTool, 'json-to-kotlin', 'JSON to Kotlin Data Class', 'kotlin'],
      [jsonToJavaTool, 'json-to-java', 'JSON to Java Record', 'java'],
      [jsonToCsharpTool, 'json-to-csharp', 'JSON to C# Class', 'csharp'],
      [jsonToPythonTool, 'json-to-python', 'JSON to Python Dataclass', 'python'],
      [jsonToSwiftTool, 'json-to-swift', 'JSON to Swift Codable', 'swift'],
    ] as const;

    for (const [tool, id, name, language] of aliases) {
      assert.equal(tool.id, id);
      assert.equal(tool.name, name);
      assert.equal(tool.aliasOf, 'json-to-code-types');
      assert.equal(tool.fields?.find((field) => field.id === 'language')?.defaultValue, language);

      assert.ok(
        tool.samples?.every((sample) => sample.fields?.language === language),
        id,
      );
    }
  });
});

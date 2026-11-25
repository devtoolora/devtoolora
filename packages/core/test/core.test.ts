import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import {
  canRunTool,
  createToolRegistry,
  isCssDesignPreview,
  isToolFieldHidden,
  isToolFileMode,
  isToolInputHidden,
  resolveToolInputPresentation,
  filterToolsByCapability,
  serializeToolDefinitions,
  ToolDefinition,
  ToolError,
  toolRuntimeCapabilities,
  toolSupportsCapability,
  validateToolRegistry,
} from '../src';

function registryTool(overrides: Partial<ToolDefinition> = {}): ToolDefinition {
  return {
    id: 'demo-tool',
    name: 'Demo Tool',
    category: 'Text',
    description: 'Demo tool.',
    inputKind: 'none',
    outputKind: 'text',
    supportsSelection: false,
    run: () => ({ text: 'ok' }),
    ...overrides,
  };
}

describe('core tool contracts', () => {
  it('requires a file instead of text while file encoding hides the text input', () => {
    for (const mode of ['encode', 'decode']) {
      const tool = registryTool({
        fields: [
          {
            defaultValue: 'text',
            id: 'inputType',
            label: 'Input',
            options: [
              { label: 'Text', value: 'text' },
              { label: 'File', value: 'file' },
            ],
            type: 'select',
          },
          {
            defaultValue: mode,
            id: 'mode',
            label: 'Mode',
            options: [
              { label: 'Encode', value: 'encode' },
              { label: 'Decode', value: 'decode' },
            ],
            type: 'select',
          },
          {
            id: 'file',
            label: 'File',
            required: true,
            type: 'file',
            visibleWhen: [
              { field: 'inputType', is: ['file'] },
              { field: 'mode', isNot: ['decode'] },
            ],
          },
        ],
        inputKind: 'text',
        inputVisibleWhen: {
          anyOf: [
            { field: 'inputType', isNot: ['file'] },
            { field: 'mode', is: ['decode'] },
          ],
        },
        textConversion: { decodedLabel: 'Text', encodedLabel: 'Base64' },
      });

      assert.equal(canRunTool(tool, 'ignored', { inputType: 'file', mode: 'encode' }), false);

      assert.equal(
        canRunTool(tool, '', {
          inputType: 'file',
          mode: 'encode',
          file: 'data:application/octet-stream;base64,',
        }),
        true,
      );

      assert.equal(canRunTool(tool, '/w==', { inputType: 'file', mode: 'decode' }), true);
      assert.equal(canRunTool(tool, '', { inputType: 'file', mode: 'decode' }), false);
    }
  });

  it('validates canonical alias targets without duplicating tool names', () => {
    const canonical = registryTool();
    const alias = registryTool({ aliasOf: canonical.id, id: 'legacy-tool' });

    assert.equal(validateToolRegistry([canonical, alias]).length, 2);
    assert.throws(() => validateToolRegistry([alias]), /canonical tool/);

    assert.throws(
      () => validateToolRegistry([registryTool({ aliasOf: 'demo-tool' })]),
      /canonical tool/,
    );

    assert.throws(
      () => validateToolRegistry([canonical, registryTool({ id: 'duplicate-name' })]),
      /Duplicate tool name/,
    );
  });

  it('rejects related tools that point at an alias', () => {
    const canonical = registryTool({ id: 'c' });
    const alias = registryTool({ aliasOf: 'c', id: 'b', name: 'Legacy' });
    const tool = registryTool({ id: 'a', name: 'Other', relatedToolIds: ['b'] });

    assert.throws(
      () => validateToolRegistry([canonical, alias, tool]),
      (error: unknown) =>
        error instanceof ToolError &&
        error.message === 'Tool a references alias b in relatedToolIds; use c.',
    );
  });

  it('validates run requirements, input conditions and the selection target', () => {
    const fields: ToolDefinition['fields'] = [
      {
        defaultValue: 'a',
        id: 'mode',
        label: 'Mode',
        options: [
          { label: 'A', value: 'a' },
          { label: 'B', value: 'b' },
        ],
        type: 'select',
      },
      { id: 'upload', label: 'Upload', type: 'file' },
    ];
    const tool = (overrides: Partial<ToolDefinition>) =>
      registryTool({ fields, inputKind: 'text', ...overrides });

    for (const overrides of [
      { runRequires: [{ anyOf: ['$text', 'missing'] }] },
      { runRequires: [{ anyOf: ['$text'], when: { field: 'missing', is: ['x'] } }] },
      { inputVisibleWhen: { field: 'missing', is: ['x'] } },
      { fileModeWhen: { field: 'mode', is: ['unknown'] } },
      { selectionTarget: { field: 'missing' } },
    ] satisfies Array<Partial<ToolDefinition>>) {
      assert.throws(
        () => validateToolRegistry([tool(overrides)]),
        ToolError,
        JSON.stringify(overrides),
      );
    }

    assert.doesNotThrow(() =>
      validateToolRegistry([
        tool({
          fileModeWhen: { field: 'mode', is: ['b'] },
          inputVisibleWhen: { field: 'mode', isNot: ['b'] },
          runRequires: [
            { anyOf: ['$text', 'upload', 'uploadName'], when: { field: 'mode', is: ['a'] } },
          ],
          selectionTarget: { field: 'mode', fields: { mode: 'b' } },
        }),
      ]),
    );
  });

  it('allows whitespace text in converters without enabling empty inputs', () => {
    for (const id of [
      'base64-encode',
      'base64-decode',
      'url-encode',
      'url-decode',
      'html-entities',
      'text-binary',
      'hex-text',
      'ascii-text',
      'unicode-escape',
      'morse-code',
    ]) {
      const tool = registryTool({
        id,
        inputKind: 'text',
        textConversion: { decodedLabel: 'Text', encodedLabel: 'Encoded text' },
      });

      assert.equal(canRunTool(tool, ' ', {}), true);
      assert.equal(canRunTool(tool, '', {}), false);
    }
  });

  it('needs non-blank values in required fields', () => {
    const tool = registryTool({
      fields: [
        { id: 'username', label: 'Username', required: true, type: 'text' },
        { id: 'password', label: 'Password', required: true, type: 'password' },
      ],
    });

    assert.equal(canRunTool(tool, '', { username: ' ', password: ' ' }), false);
    assert.equal(canRunTool(tool, '', { username: 'demo', password: '' }), false);
    assert.equal(canRunTool(tool, '', { username: ' demo', password: 'p ' }), true);
  });

  it('counts every character of a required password, including spaces', () => {
    const tool = registryTool({
      fields: [{ id: 'password', label: 'Password', required: true, type: 'password' }],
      inputKind: 'none',
    });

    assert.equal(canRunTool(tool, '', { password: '   ' }), true);
    assert.equal(canRunTool(tool, '', { password: '' }), false);
    assert.equal(canRunTool(tool, '', {}), false);
  });

  it('filters tools by runtime capability', () => {
    assert.deepEqual(toolRuntimeCapabilities, [
      'browserWorker',
      'browserMain',
      'vscode',
      'desktop',
    ]);

    assert.equal(toolSupportsCapability(registryTool(), 'browserWorker'), false);

    assert.equal(
      toolSupportsCapability(registryTool({ capabilities: ['browserWorker'] }), 'browserWorker'),
      true,
    );

    assert.deepEqual(
      filterToolsByCapability(
        [registryTool(), registryTool({ id: 'browser-tool', capabilities: ['browserWorker'] })],
        'browserWorker',
      ).map((tool) => tool.id),
      ['browser-tool'],
    );
  });

  it('serializes tool metadata without executable runners', () => {
    const [serializedTool] = serializeToolDefinitions([
      registryTool({ capabilities: ['browserWorker'] }),
    ]);

    assert.ok(serializedTool);
    assert.equal(serializedTool.id, 'demo-tool');
    assert.equal('run' in serializedTool, false);
    assert.deepEqual(serializedTool.capabilities, ['browserWorker']);
  });

  it('gates tool execution by requested runtime capability', async () => {
    const registry = createToolRegistry([registryTool({ capabilities: ['browserWorker'] })]);

    assert.equal(
      (await registry.runToolWithCapability('demo-tool', { text: '', fields: {} }, 'browserWorker'))
        .text,
      'ok',
    );

    await assert.rejects(
      () => registry.runToolWithCapability('demo-tool', { text: '', fields: {} }, 'desktop'),
      /does not support runtime capability: desktop/,
    );
  });

  it('rejects invalid registry metadata before tools reach the UI', () => {
    assert.throws(
      () =>
        validateToolRegistry([registryTool({ capabilities: ['browserWorker', 'browserWorker'] })]),
      ToolError,
    );

    assert.throws(
      () => validateToolRegistry([registryTool({ capabilities: ['server' as never] })]),
      ToolError,
    );

    assert.throws(
      () => validateToolRegistry([registryTool({ resultActions: ['download' as never] })]),
      ToolError,
    );

    assert.throws(
      () =>
        validateToolRegistry([
          registryTool({
            fields: [
              {
                id: 'mode',
                label: 'Mode',
                type: 'select',
                defaultValue: 'bad',
                options: [{ label: 'Good', value: 'good' }],
              },
            ],
          }),
        ]),
      ToolError,
    );

    assert.throws(
      () =>
        validateToolRegistry([
          registryTool({
            fields: [
              {
                id: 'templates',
                label: 'Templates',
                type: 'checkboxGroup',
                defaultValue: 'missing',
                options: [{ label: 'Node.js', value: 'node' }],
              },
            ],
          }),
        ]),
      ToolError,
    );

    assert.throws(
      () =>
        validateToolRegistry([
          registryTool({
            fields: [{ id: 'value', label: 'Value', type: 'text' }],
            samples: [{ label: 'Bad', fields: { missing: 'x' } }],
          }),
        ]),
      ToolError,
    );

    assert.equal(
      validateToolRegistry([
        registryTool({
          fields: [{ id: 'file', label: 'File', type: 'file' }],
          samples: [{ label: 'Named file', fields: { file: 'data:,x', fileName: 'notes.txt' } }],
        }),
      ]).length,
      1,
    );

    assert.throws(
      () =>
        validateToolRegistry([
          registryTool({
            fields: [{ id: 'value', label: 'Value', type: 'text' }],
            samples: [{ label: 'Bad', fields: { valueName: 'x' } }],
          }),
        ]),
      /unknown field: valueName/,
    );

    assert.throws(
      () => validateToolRegistry([registryTool(), registryTool({ id: 'other-tool' })]),
      ToolError,
    );
  });

  it('validates tool run eligibility accurately', () => {
    assert.equal(canRunTool(undefined, '', {}), false);

    const textTool = registryTool({ inputKind: 'text' });

    assert.equal(canRunTool(textTool, '', {}), false);
    assert.equal(canRunTool(textTool, '  ', {}), false);
    assert.equal(canRunTool(textTool, 'valid text', {}), true);

    const hmacToolDef = registryTool({
      inputKind: 'optionalText',
      fields: [{ id: 'secret', label: 'Secret', required: true, type: 'password' }],
    });

    assert.equal(canRunTool(hmacToolDef, 'data', {}), false);
    assert.equal(canRunTool(hmacToolDef, '', { secret: 'key' }), true);
    assert.equal(canRunTool(hmacToolDef, 'data', { secret: 'key' }), true);

    const imageToolDef = registryTool({
      inputKind: 'none',
      fields: [{ id: 'image', label: 'Image', required: true, type: 'file' }],
    });

    assert.equal(canRunTool(imageToolDef, '', {}), false);
    assert.equal(canRunTool(imageToolDef, '', { image: 'data:image/png;base64,abc' }), true);

    const pixelDiffDef = registryTool({
      inputKind: 'none',
      fields: [
        { id: 'beforeImage', label: 'Before', required: true, type: 'file' },
        { id: 'afterImage', label: 'After', required: true, type: 'file' },
      ],
    });

    assert.equal(canRunTool(pixelDiffDef, '', { beforeImage: 'data:...' }), false);

    assert.equal(
      canRunTool(pixelDiffDef, '', { beforeImage: 'data:...', afterImage: 'data:...' }),
      true,
    );

    const semverDef = registryTool({
      inputKind: 'none',
      fields: [
        { id: 'left', label: 'Left', required: true, type: 'text' },
        { id: 'right', label: 'Right', required: true, type: 'text' },
      ],
    });

    assert.equal(canRunTool(semverDef, '', { left: '1.0.0' }), false);
    assert.equal(canRunTool(semverDef, '', { left: '1.0.0', right: '1.1.0' }), true);

    const generatorDef = registryTool({ id: 'uuid', inputKind: 'none', requiresInput: false });

    assert.equal(canRunTool(generatorDef, '', {}), true);
  });

  it('shows fields, requires values and labels the input from declarative conditions', () => {
    const tool = registryTool({
      fields: [
        {
          defaultValue: 'decode',
          id: 'mode',
          label: 'Mode',
          options: [
            { label: 'Decode', value: 'decode' },
            { label: 'Sign', value: 'sign' },
          ],
          type: 'select',
        },
        {
          id: 'key',
          label: 'Key',
          required: true,
          type: 'textarea',
          visibleWhen: { field: 'mode', is: ['sign'] },
        },
        {
          id: 'alt',
          label: 'Alt',
          type: 'text',
          visibleWhen: [
            { field: 'mode', isNot: ['decode'] },
            { field: 'key', isNot: [''] },
          ],
        },
      ],
      inputKind: 'text',
      inputPresentation: {
        byMode: { sign: { label: 'Payload JSON' } },
        label: 'JWT',
        placeholder: 'eyJ…',
      },
    });

    assert.equal(validateToolRegistry([tool]).length, 1);
    assert.equal(isToolFieldHidden(tool, 'key', {}), true);
    assert.equal(isToolFieldHidden(tool, 'key', { mode: 'sign' }), false);
    assert.equal(isToolFieldHidden(tool, 'alt', { key: 'k', mode: 'sign' }), false);
    assert.equal(isToolFieldHidden(tool, 'alt', { key: '', mode: 'sign' }), true);
    assert.equal(isToolFieldHidden(tool, 'mode', {}), false);
    assert.equal(canRunTool(tool, 'token', {}), true);
    assert.equal(canRunTool(tool, 'token', { key: ' ', mode: 'sign' }), false);
    assert.equal(canRunTool(tool, 'token', { key: 'secret', mode: 'sign' }), true);
    assert.deepEqual(resolveToolInputPresentation(tool, {}), { label: 'JWT', placeholder: 'eyJ…' });

    assert.deepEqual(resolveToolInputPresentation(tool, { mode: 'sign' }), {
      label: 'Payload JSON',
    });

    assert.equal(resolveToolInputPresentation(registryTool(), {}), undefined);
  });

  it('evaluates anyOf field conditions as OR', () => {
    const tool = registryTool({
      fields: [
        { id: 'op', label: 'Op', type: 'text' },
        { id: 'c', label: 'C', type: 'text' },
        {
          id: 'x',
          label: 'X',
          type: 'text',
          visibleWhen: {
            anyOf: [
              { field: 'op', is: ['a'] },
              { field: 'c', is: ['x'] },
            ],
          },
        },
      ],
    });

    assert.equal(validateToolRegistry([tool]).length, 1);
    assert.equal(isToolFieldHidden(tool, 'x', { op: 'b', c: 'y' }), true);
    assert.equal(isToolFieldHidden(tool, 'x', { op: 'a', c: 'y' }), false);
    assert.equal(isToolFieldHidden(tool, 'x', { op: 'b', c: 'x' }), false);
    assert.equal(isToolFieldHidden(tool, 'x', { op: 'a', c: 'x' }), false);
  });

  it('hides the primary input from declarative conditions', () => {
    const tool = registryTool({
      fields: [{ id: 'inputType', label: 'Input', type: 'text' }],
      inputVisibleWhen: { field: 'inputType', isNot: ['file'] },
    });

    assert.equal(isToolInputHidden(tool, { inputType: 'file' }), true);
    assert.equal(isToolInputHidden(tool, {}), false);
    assert.equal(isToolInputHidden(registryTool(), {}), false);
  });

  it('detects file mode only for tools that declare it', () => {
    const tool = registryTool({ fileModeWhen: { field: 'inputType', is: ['file'] } });

    assert.equal(isToolFileMode(tool, { inputType: 'file' }), true);
    assert.equal(isToolFileMode(tool, { inputType: 'text' }), false);
    assert.equal(isToolFileMode(registryTool(), { inputType: 'file' }), false);
  });

  it('runs from declared requirements instead of generic text checks', () => {
    const certificate = registryTool({
      fields: [{ id: 'certificateFile', label: 'File', type: 'file' }],
      inputKind: 'text',
      runRequires: [{ anyOf: ['$text', 'certificateFile'] }],
    });

    assert.equal(canRunTool(certificate, '', { certificateFile: 'x' }), true);
    assert.equal(canRunTool(certificate, '', {}), false);
    assert.equal(canRunTool(certificate, 'pem', {}), true);
    assert.equal(canRunTool(certificate, ' ', { certificateFile: ' ' }), false);

    const icon = registryTool({
      fields: [
        { id: 'sourceMode', label: 'Source', type: 'text' },
        { id: 'image', label: 'Image', type: 'file' },
      ],
      runRequires: [{ anyOf: ['image'], when: { field: 'sourceMode', isNot: ['text'] } }],
    });

    assert.equal(canRunTool(icon, '', { sourceMode: 'text' }), true);
    assert.equal(canRunTool(icon, '', { sourceMode: 'image' }), false);
    assert.equal(canRunTool(icon, '', { image: 'x', sourceMode: 'image' }), true);
  });

  it('does not require a hidden primary input', () => {
    const tool = registryTool({
      fields: [{ id: 'inputType', label: 'Input', type: 'text' }],
      inputKind: 'text',
      inputVisibleWhen: { field: 'inputType', isNot: ['file'] },
      textConversion: { decodedLabel: 'Text', encodedLabel: 'Encoded' },
    });

    assert.equal(canRunTool(tool, '', { inputType: 'file' }), true);
    assert.equal(canRunTool(tool, '', { inputType: 'text' }), false);
  });

  it('flags css-* previews as CSS design previews', () => {
    assert.equal(isCssDesignPreview('css-grid'), true);
    assert.equal(isCssDesignPreview('image'), false);
    assert.equal(isCssDesignPreview(undefined), false);
  });

  it('rejects conditions on unknown fields or options and presentations for unknown modes', () => {
    const mode = {
      defaultValue: 'a',
      id: 'mode',
      label: 'Mode',
      options: [{ label: 'A', value: 'a' }],
      type: 'select' as const,
    };

    assert.throws(
      () =>
        validateToolRegistry([
          registryTool({
            fields: [
              { id: 'x', label: 'X', type: 'text', visibleWhen: { field: 'missing', is: ['a'] } },
            ],
          }),
        ]),
      /depends on unknown field: missing/,
    );

    assert.throws(
      () =>
        validateToolRegistry([
          registryTool({
            fields: [
              mode,
              { id: 'x', label: 'X', type: 'text', visibleWhen: { field: 'mode', is: ['b'] } },
            ],
          }),
        ]),
      /unknown mode option/,
    );

    assert.throws(
      () =>
        validateToolRegistry([
          registryTool({
            fields: [mode, { id: 'x', label: 'X', type: 'text', visibleWhen: { field: 'mode' } }],
          }),
        ]),
      /empty visibility condition/,
    );

    assert.throws(
      () =>
        validateToolRegistry([
          registryTool({
            fields: [mode],
            inputPresentation: { byMode: { b: { label: 'B' } }, label: 'A' },
          }),
        ]),
      /input presentation for an unknown mode/,
    );
  });
});

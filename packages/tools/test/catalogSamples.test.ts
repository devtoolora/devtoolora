import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { canRunTool, type ToolDefinition, type ToolResult } from '@devtoolora/core';
import { domainTools, type ToolDomain } from '../src/catalog';

const allTools: ToolDefinition[] = (Object.keys(domainTools) as ToolDomain[]).flatMap(
  (domain) => domainTools[domain],
);
// These need canvas, image decoding or a wasm runtime; the browser specs run their samples.
const browserOnly =
  /browser (?:canvas|image) APIs|requires a browser page|is not loaded in this worker|could not be (?:decoded|converted|processed)|No image could be/;

function hasOutput(result: ToolResult): boolean {
  return (
    Boolean(result.text) ||
    Object.keys(result).some((key) => key !== 'text' && key !== 'summary' && key !== 'language')
  );
}

describe('catalog samples', () => {
  const runnable = allTools.flatMap((tool) =>
    (tool.samples ?? []).map((sample) => ({ sample, tool })),
  );

  it('every tool offers a sample', () => {
    assert.deepEqual(
      allTools.filter((tool) => !tool.samples?.length).map((tool) => tool.id),
      [],
    );
  });

  it.each(
    runnable.map(({ sample, tool }) => [`${tool.id}: ${sample.label}`, tool, sample] as const),
  )('%s runs and produces a result', async (_name, tool, sample) => {
    const fields = {
      ...Object.fromEntries(
        (tool.fields ?? []).map((field) => [field.id, field.defaultValue ?? '']),
      ),
      ...sample.fields,
    };
    const text = sample.text ?? '';

    assert.ok(canRunTool(tool, text, fields), 'the Run button would stay disabled');

    try {
      assert.ok(hasOutput(await tool.run({ fields, text })), 'the sample produced no output');
    } catch (error) {
      if (!browserOnly.test(String(error))) throw error;
    }
  });
});

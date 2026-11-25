import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import type { ToolDefinition } from '@devtoolora/core';
import { domainTools, type ToolDomain } from '../src/catalog';

const tools = (Object.keys(domainTools) as ToolDomain[]).flatMap<ToolDefinition>(
  (domain) => domainTools[domain],
);
const tool = (id: string) => tools.find((candidate) => candidate.id === id) as ToolDefinition;

describe('color inputs written straight into output', () => {
  // A canvas ignores `ff0000` and an SVG or manifest would print it, so it is no color here.
  it('svg-placeholder rejects hex without its #', async () => {
    await assert.rejects(
      async () =>
        tool('svg-placeholder').run({
          fields: { background: 'ff0000', foreground: '#ffffff', height: '60', width: '120' },
          text: '',
        }),
      /needs its #|not a CSS color/,
    );
  });

  it('web-manifest-generator rejects hex without its #', async () => {
    const generator = tool('web-manifest-generator');
    const sample = generator.samples?.[0];
    const defaults = Object.fromEntries(
      (generator.fields ?? []).map((field) => [field.id, field.defaultValue ?? '']),
    );

    await assert.rejects(
      async () =>
        generator.run({
          fields: { ...defaults, ...sample?.fields, themeColor: 'ff0000' },
          text: sample?.text ?? '',
        }),
      /not a CSS color/,
    );
  });
});

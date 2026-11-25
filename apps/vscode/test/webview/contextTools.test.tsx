// @vitest-environment jsdom
import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { vscodeToolMetadata } from '../../src/extension/toolMetadata.generated';
import { ContextTools } from '../../src/webview/client/components/context-tools';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const tools = vscodeToolMetadata.filter((tool) =>
  ['json-format', 'json-tree', 'json-to-typescript'].includes(tool.id),
);

describe('ContextTools', () => {
  it('suggests other tools for a recognized result and nothing for prose or the active tool', async () => {
    const selected: Array<[string, string]> = [];
    const container = document.body.appendChild(document.createElement('div'));
    const root = createRoot(container);
    const render = (text: string) =>
      act(async () => {
        root.render(
          <ContextTools
            activeToolId="json-format"
            intro="Continue with result: "
            label="Continue with result"
            text={text}
            tools={tools}
            onSelectTool={(toolId, value) => selected.push([toolId, value])}
          />,
        );
      });

    await render('{"name":"Ada"}');
    const section = container.querySelector('section[aria-label="Continue with result"]');

    assert.ok(section, 'section');
    assert.equal(section.querySelector('p')?.textContent, 'Continue with result: Detected JSON.');

    assert.deepEqual(
      Array.from(section.querySelectorAll('button')).map((button) => button.textContent),
      ['JSON Tree', 'JSON to TypeScript Types'],
    );

    await act(async () => {
      section.querySelectorAll('button')[1]?.click();
    });

    assert.deepEqual(selected, [['json-to-typescript', '{"name":"Ada"}']]);

    await render('ordinary prose');
    assert.equal(container.querySelector('section'), null);

    await act(async () => {
      root.unmount();
    });
  });
});

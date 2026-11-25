// @vitest-environment jsdom
import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { ToolResult } from '@devtoolora/core';
import { TextDiffPreview } from '../src/tool-runner/previews';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const line = { ending: 'LF' as const, number: 3, text: 'a' };
const rows = [{ after: line, before: line, kind: 'unchanged' as const }];

async function headings(report: NonNullable<ToolResult['textDiff']>): Promise<string[]> {
  const container = document.body.appendChild(document.createElement('div'));
  const root = createRoot(container);

  await act(async () => {
    root.render(<TextDiffPreview report={report} />);
  });

  const texts = [...container.querySelectorAll('h4')].map((node) => node.textContent ?? '');

  await act(async () => {
    root.unmount();
  });

  return texts;
}

describe('text diff preview', () => {
  it('shows line endings by default', async () => {
    assert.deepEqual(await headings({ layout: 'split', rows }), ['Before 3 · LF', 'After 3 · LF']);
  });

  it('leaves line endings out when the report turns them off', async () => {
    assert.deepEqual(await headings({ layout: 'unified', rows, showLineEndings: false }), [
      'Before 3',
      'After 3',
    ]);
  });
});

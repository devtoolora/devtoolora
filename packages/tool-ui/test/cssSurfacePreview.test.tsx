// @vitest-environment jsdom
import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { ToolPreviewKind } from '@devtoolora/core';
import { CssLivePreview } from '../src/tool-runner/previews';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

async function render(
  kind: ToolPreviewKind,
  css: string | undefined,
  fields: Record<string, string> = {},
): Promise<HTMLElement> {
  const container = document.body.appendChild(document.createElement('div'));

  await act(async () => {
    createRoot(container).render(<CssLivePreview css={css} fields={fields} kind={kind} />);
  });

  return container;
}

const neumorphismCss = '.neumorphism {\n  background: #e0e5ec;\n  border-radius: 16px;\n}';

describe('css glass preview', () => {
  it('applies the rule to a card with sample text over the patterned backdrop', async () => {
    const container = await render(
      'css-glass',
      '.glass {\n  background: rgba(255, 255, 255, 0.2);\n  border-radius: 16px;\n}',
    );
    const card = container.querySelector<HTMLElement>('[data-css-preview="glass"]');

    assert.match(card?.style.cssText ?? '', /border-radius: 16px/);
    assert.match(card?.textContent ?? '', /Glass panel/);
    assert.ok(container.querySelector('[data-patterned-backdrop]'));
  });

  it('waits for valid CSS', async () => {
    assert.match((await render('css-glass', undefined)).textContent ?? '', /Waiting for valid CSS/);
  });
});

describe('css neumorphism preview', () => {
  it('paints the viewport with a valid base color', async () => {
    const container = await render('css-neumorphism', neumorphismCss, { baseColor: '#E0E5EC' });
    const card = container.querySelector<HTMLElement>('[data-css-preview="neumorphism"]');

    assert.ok(card?.textContent);
    assert.equal(card?.parentElement?.style.backgroundColor, 'rgb(224, 229, 236)');
  });

  it('leaves the viewport alone for an invalid color or missing css', async () => {
    const invalid = await render('css-neumorphism', neumorphismCss, { baseColor: '#fff}' });

    assert.equal(
      invalid.querySelector<HTMLElement>('[data-css-preview]')?.parentElement?.style
        .backgroundColor,
      '',
    );

    assert.match(
      (await render('css-neumorphism', undefined, { baseColor: '#e0e5ec' })).textContent ?? '',
      /Waiting/,
    );
  });
});

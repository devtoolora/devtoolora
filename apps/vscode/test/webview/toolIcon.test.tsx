// @vitest-environment jsdom
import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import type { ToolBadge } from '@devtoolora/core';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { ToolIcon } from '../../src/webview/client/components/tool-icon';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

async function mount(props: { badge?: ToolBadge; category: string; size?: number }) {
  const container = document.body.appendChild(document.createElement('div'));
  const root = createRoot(container);

  await act(async () => {
    root.render(<ToolIcon {...props} />);
  });

  const icon = container.firstElementChild as HTMLElement;

  return { container, icon, root };
}

describe('ToolIcon', () => {
  it('renders a glyph for tools with a custom glyph and the category svg otherwise', async () => {
    const glyph = await mount({ badge: { accent: 'signal', glyph: '64' }, category: 'Encoders' });

    assert.equal(glyph.icon.getAttribute('aria-hidden'), 'true');
    assert.equal(glyph.icon.textContent, '64');
    assert.equal(glyph.icon.querySelector('svg'), null);
    assert.match(glyph.icon.className, /signal/);

    const svg = await mount({ category: 'Text', size: 22 });
    const element = svg.icon.querySelector('svg');

    assert.ok(element, 'category icon renders an svg');
    assert.equal(element.getAttribute('viewBox'), '0 0 24 24');
    assert.equal(element.getAttribute('width'), '22');
    assert.ok(element.children.length > 0, 'svg carries the category shapes');
    assert.match(svg.icon.className, /calibration/);

    const keyIcon = await mount({
      badge: { accent: 'calibration', icon: 'key-round' },
      category: 'Encoders',
    });

    assert.ok(keyIcon.icon.querySelector('svg'), 'icon badge renders an svg');
    assert.match(keyIcon.icon.className, /calibration/);

    await act(async () => {
      glyph.root.unmount();
      keyIcon.root.unmount();
      svg.root.unmount();
    });
  });

  it('falls back to the generic icon for an unknown category', async () => {
    const { icon, root } = await mount({ category: 'Nope' });
    const path = icon.querySelector('path');

    assert.ok(path);
    assert.match(path.getAttribute('d') ?? '', /^M14\.7 6\.3/);
    assert.match(icon.className, /signal/);
    await act(async () => root.unmount());
  });
});

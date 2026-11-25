// @vitest-environment jsdom
import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { SerializedToolDefinition, ToolResult } from '@devtoolora/core';
import { ToolVisualPreview } from '../src/tool-runner/previews';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

type SvgPath = NonNullable<ToolResult['svgPath']>;

const tool: SerializedToolDefinition = {
  category: 'Images & Codes',
  description: 'Edit path data.',
  id: 'svg-path-editor',
  inputKind: 'text',
  name: 'SVG Path Editor',
  outputKind: 'text',
  preview: 'svg-path',
  supportsSelection: true,
};

const curve: SvgPath = {
  bbox: { height: 5, width: 10, x: 0, y: 0 },
  d: 'M0 0\nC0 5 10 5 10 0',
  display: 'stroke',
  pointCount: 4,
  points: [
    { index: 0, kind: 'end', x: 0, y: 0 },
    { anchor: { x: 0, y: 0 }, index: 1, kind: 'control', x: 0, y: 5 },
    { anchor: { x: 10, y: 0 }, index: 1, kind: 'control', x: 10, y: 5 },
    { index: 1, kind: 'end', x: 10, y: 0 },
  ],
};

async function render(svgPath: SvgPath): Promise<HTMLElement> {
  const container = document.body.appendChild(document.createElement('div'));

  await act(async () => {
    createRoot(container).render(
      <ToolVisualPreview
        fields={{}}
        result={{ svgPath, text: svgPath.d }}
        text=""
        tool={tool}
        onFieldChange={() => undefined}
        onSampleApply={() => undefined}
      />,
    );
  });

  return container;
}

describe('SvgPathPreview', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('draws end points as circles, control points as squares and their handles', async () => {
    const container = await render(curve);

    assert.equal(container.querySelector('svg > path')?.getAttribute('d'), curve.d);
    assert.equal(container.querySelectorAll('circle').length, 2);
    assert.equal(container.querySelectorAll('rect').length, 2);
    assert.equal(container.querySelectorAll('line').length, 2);
    assert.equal(container.querySelector('svg')?.getAttribute('viewBox'), '-0.5 -0.5 11 6');
  });

  it('lists every point for assistive technology', async () => {
    const list = (await render(curve)).querySelector('ol');

    assert.ok(list);

    assert.deepEqual(
      [...list.querySelectorAll('li')].map((item) => item.textContent),
      [
        'Point 1: end of command 0 at 0, 0',
        'Point 2: control of command 1 at 0, 5',
        'Point 3: control of command 1 at 10, 5',
        'Point 4: end of command 1 at 10, 0',
      ],
    );
  });

  it('hides the overlay above 2,000 points with a note', async () => {
    const container = await render({ ...curve, pointCount: 2345, points: [] });

    assert.ok(container.querySelector('svg > path'));
    assert.equal(container.querySelectorAll('circle, rect, line, ol').length, 0);
    assert.match(container.textContent ?? '', /2,345 points; the overlay shows up to 2,000\./);
  });

  it('renders nothing for path data outside the serializer alphabet', async () => {
    const container = await render({ ...curve, d: 'M0 0"/><script>alert(1)</script>' });

    assert.equal(container.innerHTML, '');
  });
});

import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { neumorphismViewportStyle } from '../src/tool-runner/previews/css-live-preview/CssLiveStages';

describe('neumorphismViewportStyle', () => {
  it('resolves any opaque css color', () => {
    assert.equal(neumorphismViewportStyle('.x {}', 'lavender')?.backgroundColor, '#e6e6fa');
    assert.equal(neumorphismViewportStyle('.x {}', 'nope'), undefined);
  });
});

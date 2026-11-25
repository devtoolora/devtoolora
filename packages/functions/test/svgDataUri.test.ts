import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { withIntrinsicSize } from '../src/svg';

describe('withIntrinsicSize', () => {
  it('adds both sides from the viewBox', () => {
    const out = withIntrinsicSize('<svg viewBox="0 0 24 12"><path d="M0 0"/></svg>');

    assert.ok(out.includes('width="24"') && out.includes('height="12"'));
  });

  it('derives a single missing side from the viewBox ratio', () => {
    assert.ok(withIntrinsicSize('<svg height="6" viewBox="0 0 24 12"/>').includes('width="12"'));
  });

  it('leaves complete or viewBox-less svg untouched', () => {
    for (const svg of [
      '<svg width="1" height="2" viewBox="0 0 24 12"/>',
      '<svg><rect width="3"/></svg>',
    ])
      assert.equal(withIntrinsicSize(svg), svg);
  });

  it('only edits the root tag', () => {
    const out = withIntrinsicSize('<svg viewBox="0 0 8 8"><rect width="3"/></svg>');

    assert.ok(out.endsWith('<rect width="3"/></svg>'));
  });

  it('leaves non-numeric sizes alone', () => {
    for (const svg of [
      '<svg width="100%" height="100%" viewBox="0 0 24 12"/>',
      '<svg width="50%" viewBox="0 0 24 12"/>',
    ])
      assert.equal(withIntrinsicSize(svg), svg);
  });

  it('accepts px and keeps $ patterns literal', () => {
    assert.ok(withIntrinsicSize('<svg height="6px" viewBox="0 0 24 12"/>').includes('width="12"'));

    assert.equal(
      withIntrinsicSize('<svg data-x="$&" viewBox="0 0 24 12"/>'),
      '<svg width="24" height="12" data-x="$&" viewBox="0 0 24 12"/>',
    );
  });
});

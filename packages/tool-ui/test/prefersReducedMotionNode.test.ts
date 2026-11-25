// @vitest-environment node
import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { prefersReducedMotion } from '../src/tool-runner/previews/shared/usePausedByReducedMotion';

describe('prefersReducedMotion', () => {
  it('is false where window is undeclared', () => {
    assert.equal(typeof window, 'undefined');
    assert.equal(prefersReducedMotion(), false);
  });
});

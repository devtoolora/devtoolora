import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { countSelectedFiles } from '../src/tool-runner/components/tool-field-control/countSelectedFiles';

const list = (names: string[]) =>
  JSON.stringify(names.map((name) => ({ data: 'data:image/png;base64,AAAA', name })));

describe('countSelectedFiles', () => {
  it('counts 0, 1 and 3 files', () => {
    assert.equal(countSelectedFiles(''), 0);
    assert.equal(countSelectedFiles('[]'), 0);
    assert.equal(countSelectedFiles(list(['a.png'])), 1);
    assert.equal(countSelectedFiles(list(['a.png', 'b.png', 'c.png'])), 3);
  });

  it('does not over-count names that look like JSON', () => {
    assert.equal(countSelectedFiles(list(['{"name":"x"}.png', '{"a.png'])), 2);
  });
});

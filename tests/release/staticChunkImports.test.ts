import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { staticChunkImports } from './packageVerification.helpers';

describe('staticChunkImports', () => {
  it('finds named and bare static imports but not dynamic ones', () => {
    const source =
      'import{a as b}from"./one.js";import"./two.js";import "./three.js";const x=()=>import("./lazy.js");';

    assert.deepEqual(staticChunkImports(source), ['one.js', 'two.js', 'three.js']);
  });
});

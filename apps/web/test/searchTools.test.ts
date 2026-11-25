import { describe, expect, it } from 'vitest';
import { searchTools } from '../src/features/search/searchTools';
import { webToolMetadata } from '../src/toolMetadata.generated';

describe('searchTools', () => {
  it('matches every word of a query in any order, like the catalog filter', () => {
    expect(searchTools(webToolMetadata, 'json format')[0]?.id).toBe('json-format');
    expect(searchTools(webToolMetadata, 'format json')[0]?.id).toBe('json-format');
  });

  it('drops tools that miss one of the words', () => {
    expect(searchTools(webToolMetadata, 'json zzzz')).toEqual([]);
  });
});

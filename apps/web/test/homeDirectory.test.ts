import { describe, expect, it } from 'vitest';
import { searchTools } from '../src/features/search/searchTools';
import { buildHomeDirectory } from '../src/pages/home/homeDirectory';
import { webToolMetadata } from '../src/toolMetadata.generated';

describe('buildHomeDirectory', () => {
  const directory = buildHomeDirectory(webToolMetadata);

  it('counts every tool once, overall and per category', () => {
    const categoryTotal = Object.values(directory.categories).reduce(
      (total, summary) => total + (summary?.toolCount ?? 0),
      0,
    );

    expect(directory.toolCount).toBe(webToolMetadata.length);
    expect(categoryTotal).toBe(webToolMetadata.length);
  });

  it('features the first four tools of a category in catalog order', () => {
    const encoders = webToolMetadata.filter((tool) => tool.category === 'Encoders');

    expect(directory.categories.Encoders?.featuredTools).toEqual(
      encoders.slice(0, 4).map((tool) => ({ name: tool.name, slug: tool.slug })),
    );
  });

  it('keeps the results the empty search shows', () => {
    expect(directory.defaultResults).toEqual(searchTools(webToolMetadata, ''));
  });
});

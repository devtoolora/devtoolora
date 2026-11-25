import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { browserWorkerTools } from '@devtoolora/browser-catalog';
import { loadToolContent } from '@devtoolora/browser-catalog/lazy';
import { toolContentLoaders } from '../src/catalog/content.generated';

describe('tool content loaders', () => {
  it('has a loader for every canonical tool and none for aliases', () => {
    const canonical = browserWorkerTools.filter((tool) => !tool.aliasOf).map((tool) => tool.id);
    const aliases = browserWorkerTools.filter((tool) => tool.aliasOf).map((tool) => tool.id);

    assert.deepEqual(Object.keys(toolContentLoaders).sort(), [...canonical].sort());

    assert.deepEqual(
      aliases.filter((id) => id in toolContentLoaders),
      [],
    );
  });

  it('returns undefined for unknown ids', async () => {
    assert.equal(await loadToolContent('no-such-tool'), undefined);
    assert.equal(await loadToolContent('toString'), undefined);
  });
});

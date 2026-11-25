import { browserWorkerTools } from '@devtoolora/browser-catalog';
import { describe, expect, it } from 'vitest';

describe('browser catalog', () => {
  it('keeps the published tool ids stable', () => {
    const ids = browserWorkerTools
      .map((tool) => (tool.aliasOf ? `${tool.id} -> ${tool.aliasOf}` : tool.id))
      .sort();

    expect(ids).toMatchSnapshot();
  });
});

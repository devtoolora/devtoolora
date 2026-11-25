import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { renderRequest } from '../src/catalog/webApi/shared';

describe('request summary', () => {
  it('warns about credentials in the URL, which fetch refuses', () => {
    const { summary } = renderRequest(
      { headers: [], method: 'GET', url: 'https://u:p@a.test/' },
      'curl',
      false,
    );

    assert.match(summary ?? '', /Contains credentials/);
    assert.match(summary ?? '', /fetch rejects a URL with embedded credentials/);

    assert.doesNotMatch(
      renderRequest({ headers: [], method: 'GET', url: 'https://a.test/@x' }, 'curl', false)
        .summary ?? '',
      /credentials/,
    );
  });
});

import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { RegexPreview } from '../src/tool-runner/previews';

describe('RegexPreview', () => {
  it('labels an empty source instead of rendering an empty block', () => {
    const html = renderToStaticMarkup(<RegexPreview report={{ matches: [], source: '' }} />);

    assert.match(html, /<pre aria-label="Highlighted source">\(empty source\)<\/pre>/);
  });
});

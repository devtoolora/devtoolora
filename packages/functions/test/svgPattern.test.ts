import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { svgDataUri, svgPattern } from '../src/svg';

const base = { background: '#ffffff', foreground: '#6366f1', strokeSize: 2, tileSize: 24 };
const types = ['checkers', 'diagonal', 'dots', 'grid', 'zigzag'] as const;

describe('svgDataUri', () => {
  it('encodes url form with single quotes', () => {
    assert.equal(
      svgDataUri('<svg a="1"><t>#%{}</t></svg>', 'url'),
      "data:image/svg+xml,%3Csvg a='1'%3E%3Ct%3E%23%25%7B%7D%3C/t%3E%3C/svg%3E",
    );
  });

  it('uses %22 when the svg contains a single quote', () => {
    assert.equal(
      svgDataUri(`<svg a="1" b='2'/>`, 'url'),
      "data:image/svg+xml,%3Csvg a=%221%22 b='2'/%3E",
    );
  });

  it('encodes non-ASCII as UTF-8', () => {
    assert.ok(svgDataUri('<svg>é</svg>', 'url').includes('%C3%A9'));
  });

  it('round-trips base64', () => {
    const svg = '<svg>é</svg>';
    const uri = svgDataUri(svg, 'base64');

    assert.ok(uri.startsWith('data:image/svg+xml;base64,'));
    const bytes = Uint8Array.from(atob(uri.split(',')[1] ?? ''), (c) => c.charCodeAt(0));

    assert.equal(new TextDecoder().decode(bytes), svg);
  });
});

describe('svgPattern', () => {
  it.each(types)('draws a %s tile of the tile size', (type) => {
    const { tile } = svgPattern({ ...base, type });

    assert.match(tile, /width="24" height="24"/);
  });

  it('prints a full rule with background-size', () => {
    const { css } = svgPattern({ ...base, type: 'dots' });

    assert.ok(css.startsWith('.pattern {'));
    assert.ok(css.includes('background-color: #ffffff;'));
    assert.ok(css.includes('background-size: 24px 24px;'));
  });

  it('omits the background when transparent', () => {
    const { css, tile } = svgPattern({ ...base, background: undefined, type: 'dots' });

    assert.ok(!css.includes('background-color'));
    assert.ok(!tile.includes('<rect width="24" height="24"'));
  });

  it('rejects oversized strokes', () => {
    assert.throws(() => svgPattern({ ...base, strokeSize: 25, tileSize: 24, type: 'dots' }));
    assert.throws(() => svgPattern({ ...base, strokeSize: 13, tileSize: 24, type: 'grid' }));
    assert.throws(() => svgPattern({ ...base, tileSize: 3, type: 'dots' }));
  });
});

describe('svgDataUri special characters', () => {
  it('percent-encodes reserved characters and round-trips', () => {
    const svg = '<svg a="1">\\ ` | ^ >\n</svg>';
    const uri = svgDataUri(svg, 'url');

    for (const code of ['%5C', '%60', '%7C', '%5E', '%3E', '%0A']) assert.ok(uri.includes(code));

    assert.equal(
      decodeURIComponent(uri.slice('data:image/svg+xml,'.length)),
      svg.replaceAll('"', "'"),
    );
  });
});

describe('svgPattern geometry', () => {
  it('insets grid lines by half the stroke', () => {
    const { tile } = svgPattern({ ...base, strokeSize: 2, type: 'grid' });

    assert.ok(tile.includes('d="M1 0V24M0 1H24"'));
  });

  it('extends the zigzag half a period past each edge', () => {
    const { tile } = svgPattern({ ...base, type: 'zigzag' });

    assert.ok(tile.includes('points="-12,6 0,18 12,6 24,18 36,6"'));
  });
});

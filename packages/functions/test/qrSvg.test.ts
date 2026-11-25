import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { createQrSvg, createWifiPayload } from '@devtoolora/functions/qr';
import { createSvgPlaceholder, optimizeSvg } from '@devtoolora/functions/svg';

describe('QR and SVG functions', () => {
  it('creates escaped WiFi payloads and scannable SVG QR codes', async () => {
    assert.equal(
      createWifiPayload({ ssid: 'Guest;Net', password: 'secret,password', hidden: true }),
      'WIFI:T:WPA;S:Guest\\;Net;P:secret\\,password;H:true;;',
    );

    assert.match(await createQrSvg('https://example.com', { size: 128 }), /^<svg/);
  });

  it('keeps spaces around a WiFi SSID and passphrase', () => {
    assert.equal(
      createWifiPayload({ ssid: ' Cafe ', password: '  pass phrase ' }),
      'WIFI:T:WPA;S: Cafe ;P:  pass phrase ;H:false;;',
    );

    assert.throws(() => createWifiPayload({ ssid: 'Cafe', password: '   ' }), /password input/);
  });

  it('rejects sizes outside the supported range instead of clamping them', async () => {
    await assert.rejects(createQrSvg('hello', { size: 4096 }), /Size must be between 64 and 2048/);

    assert.throws(
      () => createSvgPlaceholder({ width: 20000 }),
      /Width must be between 1 and 10000/,
    );
  });

  it('creates escaped placeholders and removes SVG editor noise', () => {
    const placeholder = createSvgPlaceholder({ width: 320, height: 180, label: '<Preview>' });

    assert.match(placeholder, /&lt;Preview&gt;/);

    const result = optimizeSvg(
      '<svg viewBox="0 0 10 10"><!-- note --><metadata>editor</metadata><path d="M 0 0 L 10 10" /></svg>',
    );

    assert.doesNotMatch(result.svg, /metadata|note/);
    assert.ok(result.optimizedBytes < result.originalBytes);
  });
});

describe('QR colors', () => {
  it('accepts CSS color names, rgb() and hsl() and writes them as hex', async () => {
    const named = await createQrSvg('hello', { foreground: 'red', background: 'white' });

    assert.match(named, /stroke="#ff0000"/);
    assert.match(named, /fill="#ffffff"/);
    assert.doesNotMatch(named, /#rreedd/);

    assert.match(
      await createQrSvg('hello', { foreground: 'rgb(29 78 216)', background: 'hsl(0, 0%, 100%)' }),
      /stroke="#1d4ed8"/,
    );

    assert.match(
      await createQrSvg('hello', { foreground: '#00000080' }),
      /stroke="#000000" stroke-opacity=".50"/,
    );

    await assert.rejects(
      createQrSvg('hello', { foreground: 'reddish' }),
      /Foreground must be a CSS color, such as #1d4ed8, rgb\(29 78 216\) or navy\./,
    );
  });
});

describe('SVG optimizer prolog and text', () => {
  it('accepts an Illustrator header and never changes text content', () => {
    const source =
      '<?xml version="1.0" encoding="utf-8"?>\n<!-- Generator: Adobe Illustrator 27.0.0, SVG Export Plug-In . SVG Version: 6.00 Build 0)  -->\n<svg version="1.0" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24.000 24.000">\n  <text x="2.50" y="12.0" aria-label="Version 2.0">Version 2.0  <tspan>A</tspan> <tspan>B</tspan></text>\n  <style>.a { width: 2.0px; }  </style>\n  <path id="icon-1.0" d="M1.0.5L10.0 2.500" stroke-width="1.500" />\n</svg>\n';
    const { svg } = optimizeSvg(source);

    assert.equal(
      svg,
      '<svg version="1.0" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><text x="2.5" y="12" aria-label="Version 2.0">Version 2.0  <tspan>A</tspan> <tspan>B</tspan></text><style>.a { width: 2.0px; }  </style><path id="icon-1.0" d="M1.0.5L10 2.5" stroke-width="1.5"/></svg>',
    );

    assert.match(
      optimizeSvg(
        '<!-- leading --><!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd"><svg/>',
      ).svg,
      /^<svg\/>$/,
    );

    assert.throws(() => optimizeSvg('<div><svg></svg></div>'), /starting with <svg>/);
  });

  it('counts UTF-8 bytes', () => {
    const result = optimizeSvg('<svg>  <text>č</text>  </svg>');

    assert.equal(result.svg, '<svg><text>č</text></svg>');
    assert.equal(result.originalBytes, 30);
    assert.equal(result.optimizedBytes, 26);
  });
});

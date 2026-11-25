import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { assertSafeSvg, optimizeSvg, svgToJsx } from '../src/svg';

const options = { componentName: 'Icon', typescript: false };

function jsx(svg: string, typescript = false): string {
  return svgToJsx(assertSafeSvg(svg), { ...options, typescript });
}

function wrap(markup: string): string {
  return `export function Icon(props) {\n  return (\n${markup}\n  );\n}`;
}

describe('svgToJsx', () => {
  it('uses the React names of tabindex and for', () => {
    const output = jsx('<svg tabindex="0"><label for="y"/></svg>');

    assert.match(output, /tabIndex="0"/);
    assert.match(output, /htmlFor="y"/);
  });

  it('renames attributes and spreads props last', () => {
    assert.equal(
      jsx(
        '<svg class="i" stroke-width="2" xlink:href="#a" xml:space="preserve" data-x="1" aria-hidden="true"/>',
      ),
      wrap(
        '    <svg className="i" strokeWidth="2" xlinkHref="#a" xmlSpace="preserve" data-x="1" aria-hidden="true" {...props} />',
      ),
    );
  });

  it('keeps attributes named like Object.prototype members', () => {
    assert.equal(
      jsx('<svg constructor="a" __proto__="b" xmlns:xlink="c" xlink:href="#a"/>'),
      wrap('    <svg constructor="a" __proto__="b" xmlnsXlink="c" xlinkHref="#a" {...props} />'),
    );
  });

  it('keeps an Inkscape export on separate lines and drops unused namespaces', () => {
    const source =
      '<svg xmlns="http://www.w3.org/2000/svg" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:xlink="http://www.w3.org/1999/xlink" xml:space="preserve">\n  \n  <g>\n    <use xlink:href="#a"/>\n  </g>\n  <text> <tspan>A</tspan> </text>\n</svg>';

    assert.equal(
      jsx(source),
      wrap(
        [
          '    <svg xmlns="http://www.w3.org/2000/svg" xmlnsXlink="http://www.w3.org/1999/xlink" xmlSpace="preserve" {...props}>',
          '      <g>',
          '        <use xlinkHref="#a" />',
          '      </g>',
          '      <text> <tspan>A</tspan> </text>',
          '    </svg>',
        ].join('\n'),
      ),
    );

    assert.equal(optimizeSvg(source).svg.includes('>\n'), false);
  });

  it('turns a style attribute into an object', () => {
    assert.equal(
      jsx('<svg style="stroke-width: 2; --x: 1"/>'),
      wrap(`    <svg style={{ strokeWidth: '2', '--x': '1' }} {...props} />`),
    );
  });

  it('prints a value with a double quote as an expression', () => {
    assert.equal(jsx(`<svg title='a "b"'/>`), wrap(`    <svg title={'a "b"'} {...props} />`));
  });

  it('prints entity-bearing attribute values so JSX does not decode them again', () => {
    assert.equal(
      jsx(
        '<svg title="a &amp; b" data-x="&amp;lt;" aria-label="it&#x27;s" desc="say &quot;hi&quot;"/>',
      ),
      wrap(
        `    <svg title="a & b" data-x={'&lt;'} aria-label="it's" desc={'say "hi"'} {...props} />`,
      ),
    );
  });

  it('keeps line breaks in attribute values and text as string expressions', () => {
    assert.equal(jsx('<svg title="a&#10;b"/>'), wrap(`    <svg title={'a\\nb'} {...props} />`));

    assert.equal(
      jsx('<svg><text>line one\n  line two</text></svg>'),
      wrap(`    <svg {...props}>\n      <text>{'line one\\n  line two'}</text>\n    </svg>`),
    );

    assert.equal(
      jsx('<svg><text>a &amp;lt; b</text></svg>'),
      wrap(`    <svg {...props}>\n      <text>a {'&'}lt; b</text>\n    </svg>`),
    );
  });

  it('splits style on ; outside quotes, parentheses and comments', () => {
    assert.equal(
      jsx('<svg style="background: url(&quot;data:x;base64,AA&quot;); fill: red /* a;b */"/>'),
      wrap(`    <svg style={{ background: 'url("data:x;base64,AA")', fill: 'red' }} {...props} />`),
    );
  });

  it('rejects malformed style instead of dropping it', () => {
    assert.throws(() => jsx('<svg style="((("/>'), /unclosed "\("/);
    assert.throws(() => jsx('<svg style="fill: red&quot;"/>'), /unclosed " quote/);
    assert.throws(() => jsx('<svg style="fill: red)"/>'), /unmatched "\)"/);
    assert.throws(() => jsx('<svg style="fill: red /* x"/>'), /unclosed \/\* comment/);
  });

  it('splits a huge adversarial style in linear time', () => {
    const start = performance.now();

    assert.throws(() => jsx(`<svg style="fill:${'('.repeat(499_000)}"/>`), /unclosed "\("/);
    assert.ok(performance.now() - start < 2000);
  });

  it('escapes braces and angle brackets in text', () => {
    assert.equal(
      jsx('<svg><text>a{b}&lt;c</text></svg>'),
      wrap(`    <svg {...props}>\n      <text>a{'{'}b{'}'}{'<'}c</text>\n    </svg>`),
    );
  });

  it('drops whitespace between elements and comments', () => {
    assert.equal(
      jsx('<svg>\n  <g>\n    <!-- note -->\n    <path d="M0 0"/>\n  </g>\n</svg>'),
      wrap('    <svg {...props}>\n      <g>\n        <path d="M0 0" />\n      </g>\n    </svg>'),
    );
  });

  it('keeps the space between two tspans', () => {
    assert.equal(
      jsx('<svg><text><tspan>a</tspan> <tspan>b</tspan></text></svg>'),
      wrap(
        '    <svg {...props}>\n      <text><tspan>a</tspan> <tspan>b</tspan></text>\n    </svg>',
      ),
    );
  });

  it('turns style content into a template literal', () => {
    assert.equal(
      jsx('<svg><style><![CDATA[.a{fill:red}]]></style></svg>'),
      wrap('    <svg {...props}>\n      <style>{`.a{fill:red}`}</style>\n    </svg>'),
    );

    assert.equal(
      jsx('<svg><style>a`b${c}\\d</style></svg>'),
      wrap('    <svg {...props}>\n      <style>{`a\\`b\\${c}\\\\d`}</style>\n    </svg>'),
    );
  });

  it('adds TypeScript props', () => {
    const output = jsx('<svg/>', true);

    assert.ok(output.startsWith("import type { SVGProps } from 'react';\n\n"));
    assert.ok(output.includes('export function Icon(props: SVGProps<SVGSVGElement>) {'));
  });

  it('rejects namespaced elements that JSX cannot express', () => {
    assert.throws(() => jsx('<svg><foo:a/></svg>'), /<foo:a>/);
    assert.throws(() => jsx('<svg><?pi x?></svg>'), /processing instruction/);
  });

  it('drops editor namespaces and their declarations', () => {
    const output = jsx(
      '<svg xmlns="http://www.w3.org/2000/svg" xmlns:sketch="http://www.bohemiancoding.com/sketch/ns" xmlns:serif="http://www.serif.com/"><g sketch:type="MSPage" serif:id="Layer 1"><rect width="2" height="2"/></g><i:pgf>x</i:pgf><x:xmpmeta><a:b/></x:xmpmeta><sodipodi:namedview/></svg>',
    );

    assert.doesNotMatch(output, /sketch|serif|pgf|xmpmeta|sodipodi/);
    assert.match(output, /<rect width="2" height="2" \/>/);
  });

  it('keeps content when an editor-like prefix is bound to a standard namespace', () => {
    const output = jsx('<svg xmlns:x="http://www.w3.org/1999/xlink"><use x:href="#r"/></svg>');

    assert.match(output, /<use xlinkHref="#r" \/>/);

    assert.match(
      jsx('<svg><g xmlns:x="http://www.w3.org/1999/xlink"><use x:title="t"/></g></svg>'),
      /xlinkTitle="t"/,
    );

    assert.match(
      jsx('<svg xmlns:i="http://www.w3.org/XML/1998/namespace"><g i:space="preserve"/></svg>'),
      /xmlSpace="preserve"/,
    );

    assert.doesNotMatch(
      jsx('<svg xmlns:x="adobe:ns:meta/"><x:xmpmeta/><rect x:a="1"/></svg>'),
      /xmpmeta|xA/,
    );
  });

  it('emits no xmlns for namespaces only used by dropped editor children', () => {
    const output = jsx(
      '<svg xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:x="adobe:ns:meta/"><x:xmpmeta><dc:title/></x:xmpmeta></svg>',
    );

    assert.doesNotMatch(output, /xmlns/i);
  });

  it('caps the JSX output at 2,000,000 characters', () => {
    const nest = 98;
    const svg = `<svg>${'<g>'.repeat(nest)}${'<rect/>'.repeat(40_000)}${'</g>'.repeat(nest)}</svg>`;

    assert.ok(svg.length < 500_000);
    assert.throws(() => jsx(svg), /2,000,000/);
  });

  it('rejects !important, which React style objects ignore', () => {
    assert.throws(() => jsx('<svg style="fill: red !important"/>'), /!important/);
  });
});

describe('assertSafeSvg', () => {
  it('rejects scriptable or non-svg markup', () => {
    assert.throws(() => assertSafeSvg('<svg><script/></svg>'), /script/);
    assert.throws(() => assertSafeSvg('<svg onload="x"/>'), /onload/);
    assert.throws(() => assertSafeSvg('<svg><a href="javascript:alert(1)"/></svg>'), /javascript:/);
    assert.throws(() => assertSafeSvg('<svg><a href=" JavaScript:x"/></svg>'), /javascript:/);
    assert.throws(() => assertSafeSvg('<html/>'), /<svg>/);
  });

  it('rejects javascript: anywhere in a value, including SMIL lists and split schemes', () => {
    for (const value of ['#;javascript:alert(1)', 'java&#9;script:x', '&#106;avascript:x']) {
      assert.throws(
        () => assertSafeSvg(`<svg><a><animate attributeName="href" values="${value}"/></a></svg>`),
        /javascript:/,
      );
    }
  });

  it('skips the javascript: scan for aria-* and data-* only', () => {
    assertSafeSvg('<svg aria-label="Learn javascript: basics" data-note="javascript:"/>');
    assert.throws(() => assertSafeSvg('<svg><a href="javascript:alert(1)"/></svg>'), /javascript:/);

    assert.throws(
      () =>
        assertSafeSvg('<svg><a><animate attributeName="href" values="#a;javascript:x"/></a></svg>'),
      /javascript:/,
    );

    assert.throws(() => assertSafeSvg('<svg data-x="1" onclick="javascript:x"/>'), /onclick/);
    assert.throws(() => assertSafeSvg('<svg xlink:data-x="javascript:x"/>'), /javascript:/);
    assert.throws(() => assertSafeSvg('<svg aria-srcdoc="x" srcdoc="y"/>'), /srcdoc/);
  });

  it('rejects frames, embedded objects, srcdoc and animated event handlers', () => {
    for (const name of ['iframe', 'frame', 'object', 'embed']) {
      assert.throws(
        () =>
          assertSafeSvg(
            `<svg><foreignObject><${name} xmlns="http://www.w3.org/1999/xhtml"/></foreignObject></svg>`,
          ),
        new RegExp(`<${name}>`),
      );
    }

    assert.throws(
      () =>
        assertSafeSvg(
          '<svg><foreignObject><div srcdoc="&lt;script&gt;alert(1)&lt;/script&gt;"/></foreignObject></svg>',
        ),
      /srcdoc/,
    );

    assert.throws(
      () => assertSafeSvg('<svg><set attributeName="onclick" to="alert(1)"/></svg>'),
      /onclick/,
    );
  });

  it('rejects a lone surrogate as invalid XML', () => {
    assert.throws(() => assertSafeSvg(`<svg>${String.fromCharCode(0xd800)}</svg>`), /Invalid XML/);
  });
});

describe('optimizeSvg editor markup', () => {
  it('drops sketch, serif, Illustrator editor markup but keeps standard-bound prefixes', () => {
    const dropped = optimizeSvg(
      '<svg xmlns:sketch="urn:s" xmlns:serif="urn:f" xmlns:i="urn:i" xmlns:x="adobe:ns:meta/"><g sketch:type="a" serif:id="b"><i:pgf>q</i:pgf><x:xmpmeta/><rect/></g></svg>',
    ).svg;

    assert.doesNotMatch(dropped, /sketch|serif|pgf|xmpmeta|xmlns:/);
    assert.match(dropped, /<rect\/>/);

    const kept = optimizeSvg(
      '<svg xmlns:x="http://www.w3.org/1999/xlink"><use x:href="#r"/></svg>',
    ).svg;

    assert.match(kept, /x:href="#r"/);
  });
});

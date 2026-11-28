import { afterAll, beforeAll, describe, it } from 'vitest';
import assert from 'node:assert/strict';
import {
  optimizeSvg,
  rasterizeSvg,
  withIntrinsicSize,
  type SvgRenderRequest,
} from '@devtoolora/functions/svg';

// Results pinned on the regexes these functions used before their linear rewrites, followed by
// inputs that made those regexes backtrack for seconds.

const outcome = (run: () => unknown): unknown => {
  try {
    return run();
  } catch (error) {
    return {
      error: (error as { code?: string }).code ?? String(error),
      message: (error as Error).message,
    };
  }
};

const long = (unit: string, length = 100_000): string =>
  unit.repeat(Math.ceil(length / unit.length));

async function assertQuick(run: () => unknown): Promise<void> {
  const start = performance.now();

  await run();

  // The old regexes took more than 5 seconds on these inputs; the rewrites take milliseconds.
  assert.ok(performance.now() - start < 500, `took ${Math.round(performance.now() - start)} ms`);
}

const scope = globalThis as Record<string, unknown>;
let renderedSource = '';

async function rasterizedRoot(svg: string): Promise<unknown> {
  renderedSource = '';

  try {
    await rasterizeSvg(svg);

    return renderedSource;
  } catch (error) {
    return { error: (error as { code?: string }).code ?? String(error) };
  }
}

describe('svg regexes', () => {
  beforeAll(() => {
    scope.WorkerGlobalScope = class {};

    scope.postMessage = (request: SvgRenderRequest) => {
      renderedSource = request.source;
      request.port.postMessage({ bytes: new Uint8Array([1]) });
    };
  });

  afterAll(() => {
    delete scope.WorkerGlobalScope;
    delete scope.postMessage;
  });

  it('keeps optimizer results', () => {
    const cases: Array<[string, unknown]> = [
      [
        '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><!-- c --><path d="M0.50 0 L 10.0 10"/></svg>',
        '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><path d="M0.5 0 L 10 10"/></svg>',
      ],
      [
        '<?xml version="1.0"?><!DOCTYPE svg><svg><style><![CDATA[a>b{}]]></style><?pi x?></svg>',
        '<svg><style><![CDATA[a>b{}]]></style><?pi x?></svg>',
      ],
      ['<svg><!-- x</svg>', '<svg>'],
      [
        '<svg><g title="a>b" data-x=\'<\'>t</g></svg>',
        '<svg><g title="a>b" data-x=\'<\'>t</g></svg>',
      ],
      [
        '<svg><metadata><rdf>x</rdf></metadata><text xml:space="preserve">  a  </text></svg>',
        '<svg><text xml:space="preserve">  a  </text></svg>',
      ],
      [
        '<svg xmlns:sodipodi="http://sodipodi.sourceforge.net/DTD/sodipodi-0.dtd" sodipodi:docname="a"><sodipodi:namedview/><path   d="M0 0"   /></svg>',
        '<svg><path d="M0 0"/></svg>',
      ],
      ['<svg><path\n  d="M1 1"\n  fill="red"\n/></svg>', '<svg><path d="M1 1" fill="red"/></svg>'],
      ['<svg><g a="unclosed></g></svg>', '<svg><g a="unclosed></g></svg>'],
      ['<svg><a <b>c</b></svg>', '<svg><a <b>c</b></svg>'],
      ['<svg><![CDATA[ x </svg>', '<svg><![CDATA[ x </svg>'],
      ['<svg><? x </svg>', '<svg><? x </svg>'],
      ['<svg>< >x<>y</svg>', '<svg>< >x<>y</svg>'],
      ['<svg><g/ ><g / ></svg>', '<svg><g/><g/></svg>'],
      ['<svg><!--a--><!--b--></svg>', '<svg></svg>'],
      ['<svg><!----></svg>', '<svg></svg>'],
      ['<svg><!--></svg>-->', '<svg>'],
      ['<svg><text>a &lt; b</text></svg>', '<svg><text>a &lt; b</text></svg>'],
      [
        '<svg><tspan x="1.500 2.0">a</tspan><rect x="1.0" y="0.10"/></svg>',
        '<svg><tspan x="1.5 2">a</tspan><rect x="1" y="0.1"/></svg>',
      ],
      ['<svg><desc>é</desc></svg>', '<svg><desc>é</desc></svg>'],
    ];

    for (const [input, expected] of cases)
      assert.deepEqual(
        outcome(() => optimizeSvg(input).svg),
        expected,
        input,
      );
  });

  it('keeps intrinsic size results', () => {
    const cases: Array<[string, unknown]> = [
      ['<svg viewBox="0 0 10 20"></svg>', '<svg width="10" height="20" viewBox="0 0 10 20"></svg>'],
      [
        '<svg viewBox="0 0 10 20" width="10 px"></svg>',
        '<svg height="20" viewBox="0 0 10 20" width="10 px"></svg>',
      ],
      [
        '<svg viewBox="0 0 10 20" width=" 5 "></svg>',
        '<svg height="10" viewBox="0 0 10 20" width=" 5 "></svg>',
      ],
      [
        '<svg viewBox="0 0 10 20" width="5px "></svg>',
        '<svg height="10" viewBox="0 0 10 20" width="5px "></svg>',
      ],
      [
        '<svg viewBox="0 0 10 20" width="5 em"></svg>',
        '<svg viewBox="0 0 10 20" width="5 em"></svg>',
      ],
      [
        '<svg viewBox="0 0 10 20" height="1.5"></svg>',
        '<svg width="0.75" viewBox="0 0 10 20" height="1.5"></svg>',
      ],
      ['<svg viewBox="0 0 10 20" width="px"></svg>', '<svg viewBox="0 0 10 20" width="px"></svg>'],
      [
        '<svg viewBox="0 0 10 20" width="5pxpx"></svg>',
        '<svg viewBox="0 0 10 20" width="5pxpx"></svg>',
      ],
      [
        '<svg viewBox="0 0 10 20" width="5 p x"></svg>',
        '<svg viewBox="0 0 10 20" width="5 p x"></svg>',
      ],
      ['<svg>', '<svg>'],
      [
        '<svgx viewBox="0 0 1 1"><svg viewBox="0 0 1 2">',
        '<svgx viewBox="0 0 1 1"><svg width="1" height="2" viewBox="0 0 1 2">',
      ],
      ['<svg/ viewBox="0 0 1 1">', '<svg width="1" height="1"/ viewBox="0 0 1 1">'],
      ['<svg viewBox="0 0 1 1"', '<svg viewBox="0 0 1 1"'],
      ['a <svg\nviewBox="0 0 3 4">', 'a <svg width="3" height="4"\nviewBox="0 0 3 4">'],
    ];

    for (const [input, expected] of cases)
      assert.deepEqual(
        outcome(() => withIntrinsicSize(input)),
        expected,
        input,
      );
  });

  it('keeps rasterized root tags', async () => {
    const cases: Array<[string, unknown]> = [
      [
        '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="100"><text>Hi</text></svg>',
        '<svg width="200" height="100" viewBox="0 0 200 100" xmlns="http://www.w3.org/2000/svg"  ><text>Hi</text></svg>',
      ],
      [
        '<svg viewBox="0 0 4 2" data-a:b="1" x-1="2" -y="3"></svg>',
        '<svg xmlns="http://www.w3.org/2000/svg" width="4" height="2" viewBox="0 0 4 2"  data-a:b="1" x-1="2" -y="3"></svg>',
      ],
      [
        '<svg 1a="x" a.b-c="y" :n="z" width = \'5\' ></svg>',
        '<svg xmlns="http://www.w3.org/2000/svg" width="5" height="150" viewBox="0 0 5 150" 1a="x" a.b-c="y" :n="z"  ></svg>',
      ],
      [
        '<svg ab cd="1" e = "2"></svg>',
        '<svg xmlns="http://www.w3.org/2000/svg" width="300" height="150" viewBox="0 0 300 150" ab cd="1" e = "2"></svg>',
      ],
      [
        '<svg a="b=\'c\'" d=\'e="f"\'></svg>',
        '<svg xmlns="http://www.w3.org/2000/svg" width="300" height="150" viewBox="0 0 300 150" a="b=\'c\'" d=\'e="f"\'></svg>',
      ],
      [
        '<svg width="10"height="20"></svg>',
        '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="20" viewBox="0 0 10 20" ></svg>',
      ],
      [
        '<svg x:y:z="1" _a="2" a__="3"></svg>',
        '<svg xmlns="http://www.w3.org/2000/svg" width="300" height="150" viewBox="0 0 300 150" x:y:z="1" _a="2" a__="3"></svg>',
      ],
      [
        '<SVG viewBox="0 0 1 1"></SVG>',
        '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1" viewBox="0 0 1 1" ></SVG>',
      ],
    ];

    for (const [input, expected] of cases)
      assert.deepEqual(await rasterizedRoot(input), expected, input);
  });

  it('stays linear on unclosed markup and long tags', async () => {
    for (const unit of ['<', '<!--', '<![CDATA[', '<?', '<"<"', "'<'"])
      await assertQuick(() => optimizeSvg(`<svg>${long(unit)}`));

    await assertQuick(() => optimizeSvg(`<svg><g${long(' ')}x></svg>`));
    await assertQuick(() => withIntrinsicSize(`<svg viewBox="0 0 1 1" width=".${long(' ')}x">`));
    await assertQuick(() => withIntrinsicSize(long('<svg ')));
    await assertQuick(() => rasterizedRoot(`<svg ${long(':')}></svg>`));
    await assertQuick(() => rasterizedRoot(`<svg ${long('a')}></svg>`));
  });
});

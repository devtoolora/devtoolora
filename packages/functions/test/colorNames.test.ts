import { describe, expect, it } from 'vitest';
import { lookupColorNames } from '../src/color/names';

function names(input: string) {
  const out = lookupColorNames(input);

  return out.kind === 'color' ? out.exact.map((match) => match.name) : [];
}

describe('lookupColorNames', () => {
  it('lists synonyms as exact matches', () => {
    expect(names('#00ffff')).toEqual(['aqua', 'cyan']);
    expect(names('#663399')).toEqual(['rebeccapurple']);
  });

  it('finds the nearest names, excluding exact ones', () => {
    const out = lookupColorNames('#6495ec');

    expect(out.kind === 'color' && out.exact).toEqual([]);
    expect(out.kind === 'color' && out.nearest[0]?.name).toBe('cornflowerblue');
    expect(out.kind === 'color' && out.nearest).toHaveLength(5);
    const exact = lookupColorNames('#00ffff');

    expect(exact.kind === 'color' && exact.nearest.map((match) => match.name)).not.toContain(
      'aqua',
    );
  });

  it('notes ignored alpha', () => {
    const out = lookupColorNames('rgb(0 255 255 / 0.5)');

    expect(out.kind === 'color' && out.alphaIgnored).toBe(true);
  });

  it('searches fragments ignoring case, spaces and hyphens', () => {
    const out = lookupColorNames('slate');

    expect(out.kind === 'name' && out.matches.map((match) => match.name)).toEqual([
      'darkslateblue',
      'darkslategray',
      'darkslategrey',
      'lightslategray',
      'lightslategrey',
      'mediumslateblue',
      'slateblue',
      'slategray',
      'slategrey',
    ]);

    const spaced = lookupColorNames('Light Slate');

    expect(spaced.kind === 'name' && spaced.matches.map((match) => match.name)).toEqual([
      'lightslategray',
      'lightslategrey',
    ]);
  });

  it('explains special keywords and misses', () => {
    expect(() => lookupColorNames('transparent')).toThrow(/not in the 148/);
    expect(() => lookupColorNames('currentColor')).toThrow(/depends on/);
    expect(() => lookupColorNames('xyz')).toThrow('No CSS named color contains "xyz"');
  });

  it('treats letters-only text that fits a name as a fragment, not as bare hex', () => {
    const fragment = (text: string) => {
      const out = lookupColorNames(text);

      return out.kind === 'name' ? out.matches.map((match) => match.name) : out.kind;
    };

    expect(fragment('add')).toEqual(['saddlebrown']);
    expect(fragment('ace')).toEqual(['oldlace']);
    expect(fragment('cad')).toEqual(['cadetblue']);
    expect(fragment('dee')).toEqual(['deeppink', 'deepskyblue']);
    expect(fragment('cade')).toEqual(['cadetblue']);
    expect(fragment('fff')).toBe('color');
    expect(fragment('123')).toBe('color');
  });

  it('calls a color exact when it rounds to the same 8-bit sRGB value', () => {
    expect(names('hsl(38.8 100% 50%)')).toEqual(['orange']);
    expect(names('oklch(62.8% 0.2577 29.23)')).toEqual(['red']);
  });
});

import type { Plugin } from 'vite';
import { readFileSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync, inflateSync } from 'node:zlib';
import { transformSync } from 'esbuild';

const projectRoot = fileURLToPath(new URL('../..', import.meta.url));
const require = createRequire(import.meta.url);
const figletRoot = join(dirname(require.resolve('figlet')), '..');

export const figletFontNames: string[] = JSON.parse(
  readFileSync(join(projectRoot, 'packages', 'tools', 'src', 'figletFontNames.json'), 'utf8'),
) as string[];

export const figletFontImports: string[] = figletFontNames.map(
  (font) => `figlet/importable-fonts/${font}.js`,
);

function readFontText(font: string): string {
  const source = readFileSync(join(figletRoot, 'importable-fonts', `${font}.js`), 'utf8');
  const compiled = transformSync(source, { format: 'cjs', target: 'es2022' }).code;
  const module: { exports: { default?: unknown } } = { exports: {} };

  new Function('module', 'exports', compiled)(module, module.exports);
  if (typeof module.exports.default !== 'string')
    throw new Error(`${font} FIGlet font must be text data.`);

  return module.exports.default;
}

function compressFont(font: string): string {
  const text = readFontText(font);
  const compressed = deflateSync(Buffer.from(text, 'utf8'), { level: 9 });

  if (inflateSync(compressed).toString('utf8') !== text)
    throw new Error(`${font} FIGlet font does not survive compression.`);

  return compressed.toString('base64');
}

function compressedFontsLoader(): string {
  const fonts = figletFontNames.map((font) => `${JSON.stringify(font)}:'${compressFont(font)}'`);

  return `import { unzlibSync } from 'fflate';const fonts={${fonts.join(',')}};export async function loadFigletFont(font){const data=fonts[font];if(!data)throw new Error(\`Unknown FIGlet font: \${font}.\`);return new TextDecoder('utf-8',{ignoreBOM:true}).decode(unzlibSync(Uint8Array.from(atob(data),character=>character.charCodeAt(0))));}`;
}

export function lazyFigletFontsPlugin(options: { lazyStandard?: boolean } = {}): Plugin {
  let compressedStandard: string | undefined;
  let code: string;

  if (options.lazyStandard) {
    compressedStandard = deflateSync(
      Buffer.from(JSON.stringify(readFontText('Standard')), 'utf8'),
    ).toString('base64');

    const loaders = figletFontNames.map((font) => {
      const file = `${font}.js`;

      statSync(join(figletRoot, 'importable-fonts', file));

      return `${JSON.stringify(font)}:()=>import(${JSON.stringify(`figlet/importable-fonts/${file}`)}).then(module=>module.default)`;
    });

    code = `const loaders={${loaders.join(',')}};export async function loadFigletFont(font){const load=loaders[font];if(!load)throw new Error(\`Unknown FIGlet font: \${font}.\`);return load();}`;
  } else {
    code = compressedFontsLoader();
  }

  const loaderModule = 'virtual:figlet-font-loaders';

  return {
    name: 'lazy-figlet-fonts',
    resolveId(id: string): string | undefined {
      return options.lazyStandard && id === loaderModule ? `\0${loaderModule}` : undefined;
    },
    load(id: string): string | undefined {
      return options.lazyStandard && id === `\0${loaderModule}` ? code : undefined;
    },
    transform(_code: string, id: string) {
      const [cleanPath = id] = id.split('?');
      const isFontLoader =
        cleanPath.endsWith('/figletFontLoader.ts') || cleanPath.endsWith('/figletFontLoader.js');

      if (!isFontLoader) return undefined;

      return options.lazyStandard
        ? `import { unzlibSync } from 'fflate';const standardFont=JSON.parse(new TextDecoder().decode(unzlibSync(Uint8Array.from(atob('${compressedStandard}'),character=>character.charCodeAt(0)))));export async function loadFigletFont(font){if(font==='Standard')return standardFont;const module=await import('${loaderModule}');return module.loadFigletFont(font);}`
        : code;
    },
  };
}

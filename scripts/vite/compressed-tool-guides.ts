import { transformSync } from 'esbuild';
import { deflateSync } from 'node:zlib';
import type { Plugin } from 'vite';

export function compressedToolGuidesPlugin(): Plugin {
  return {
    name: 'compressed-tool-guides',
    transform(code: string, id: string) {
      const [path = id] = id.split('?');

      if (!path.includes('/packages/tools/') || !/\/catalog\/.+\/content\.(?:js|ts)$/.test(path))
        return undefined;

      const names = [...code.matchAll(/export\s+const\s+(\w+)/g)].map((match) => match[1]!);

      if (!names.length) return undefined;

      const compiled = transformSync(code, {
        format: 'cjs',
        loader: path.endsWith('.ts') ? 'ts' : 'js',
        target: 'es2022',
      }).code;

      // Only first-party data modules without runtime imports are evaluated at build time.
      if (/\brequire\s*\(/.test(compiled)) return undefined;

      const module: { exports: Record<string, unknown> } = { exports: {} };

      new Function('module', 'exports', compiled)(module, module.exports);
      const json = JSON.stringify(module.exports, (_key: string, value: unknown) => {
        if (typeof value === 'function' || typeof value === 'bigint' || typeof value === 'symbol')
          throw new Error('Tool guides must contain JSON data only.');

        return value;
      });
      const base64 = deflateSync(Buffer.from(json, 'utf8')).toString('base64');

      return {
        code: `import { unzlibSync } from 'fflate';const guideData=JSON.parse(new TextDecoder().decode(unzlibSync(Uint8Array.from(atob('${base64}'),character=>character.charCodeAt(0)))));${names.map((name) => `export const ${name}=guideData.${name};`).join('')}`,
        map: null,
      };
    },
  };
}

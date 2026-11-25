import { encodeBase64Text } from '@devtoolora/functions/encoding';

interface SampleMap {
  file: string;
  name: string;
  names: string[];
  source: string;
  sourcesContent?: string[];
}

const appMap: SampleMap = {
  file: 'app.min.js',
  name: 'app.min.js.map',
  names: ['boom'],
  source: 'src/app.ts',
};

const libMap: SampleMap = {
  file: 'lib.min.js',
  name: 'lib.min.js.map',
  names: ['helper'],
  source: 'src/lib.ts',
};

const withContent: SampleMap = {
  ...appMap,
  sourcesContent: ['const total = 1;\nboom(total);\nexport {};\n'],
};

const renamed: SampleMap = { ...appMap, file: 'other.js', name: 'bundle.js.map' };

export function mapsField(maps: SampleMap[]): string {
  return JSON.stringify(
    maps.map(({ file, name, names, source, sourcesContent }) => ({
      data: `data:application/json;base64,${encodeBase64Text(
        JSON.stringify({
          file,
          mappings: 'AAAA,SAASA;AACT',
          names,
          sources: [source],
          sourcesContent,
          version: 3,
        }),
      )}`,
      name,
    })),
  );
}

export const sampleMaps = {
  app: mapsField([appMap]),
  context: mapsField([withContent]),
  pair: mapsField([renamed]),
  two: mapsField([appMap, libMap]),
};

export const v8Trace = [
  'Error: boom',
  '    at boom (https://cdn.example.com/assets/app.min.js:1:12)',
  '    at https://cdn.example.com/assets/app.min.js:2:1',
].join('\n');

export const firefoxTrace = [
  'boom@https://cdn.example.com/assets/app.min.js:1:12',
  '@https://cdn.example.com/assets/app.min.js:2:1',
].join('\n');

export const mixedTrace = [
  'TypeError: helper is not a function',
  '    at helper (https://cdn.example.com/lib.min.js:1:12)',
  '    at boom (https://cdn.example.com/app.min.js:1:12)',
  '    at r (https://cdn.example.com/vendor.js:1:4021)',
].join('\n');

export const pairedTrace = ['Error: boom', '    at x (https://example.com/main.js:1:12)'].join(
  '\n',
);

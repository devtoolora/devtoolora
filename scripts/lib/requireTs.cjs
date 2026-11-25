const Module = require('node:module');
const { dirname } = require('node:path');
const { buildSync } = require('esbuild');

function requireTs(entry) {
  const [output] = buildSync({
    bundle: true,
    entryPoints: [entry],
    format: 'cjs',
    logLevel: 'error',
    platform: 'node',
    write: false,
  }).outputFiles;
  const loaded = new Module(entry, module);

  loaded.filename = entry;
  loaded.paths = Module._nodeModulePaths(dirname(entry));
  loaded._compile(output.text, entry);

  return loaded.exports;
}

module.exports = { requireTs };

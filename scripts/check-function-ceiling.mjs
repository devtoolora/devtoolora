import { ESLint } from 'eslint';
import { pathToFileURL } from 'node:url';
import tseslint from 'typescript-eslint';

import { globalIgnores } from '../eslint.config.mjs';

const CEILING = 100;

// The Node API ignores eslint-suppressions.json (a CLI feature) and inline comments are off,
// so nothing can hide a finding.
export async function findFunctionsOverCeiling(patterns, cwd = process.cwd()) {
  const eslint = new ESLint({
    allowInlineConfig: false,
    cwd,
    overrideConfig: [
      {
        ignores: [...globalIgnores, '**/test/**', '**/tests/**', '**/*.test.*', '**/*.spec.ts'],
      },
      {
        files: ['**/*.{ts,tsx,mts,cts,js,jsx,mjs,cjs}'],
        languageOptions: { parser: tseslint.parser },
        rules: {
          'max-lines-per-function': [
            'error',
            { max: CEILING, skipBlankLines: true, skipComments: true },
          ],
        },
      },
    ],
    overrideConfigFile: true,
  });
  const results = await eslint.lintFiles(patterns);

  return results.flatMap((result) =>
    result.messages.map((message) => ({
      file: result.filePath,
      line: message.line,
      // The rule's documented format: "... has too many lines (101). Maximum allowed is 100."
      lines: Number(/\((\d+)\)/.exec(message.message)?.[1]),
      message: message.message,
    })),
  );
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const found = await findFunctionsOverCeiling(['.']);

  for (const { file, line, message } of found) {
    console.log(`${file}:${line} ${message}`);
  }

  process.exit(found.length > 0 ? 1 : 0);
}

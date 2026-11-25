import stylistic from '@stylistic/eslint-plugin';
import perfectionist from 'eslint-plugin-perfectionist';
import reactHooks from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';

const sortOptions = [
  {
    customGroups: [{ elementNamePattern: '^on[A-Z]', groupName: 'callback' }],
    groups: ['unknown', 'callback'],
    ignoreCase: true,
    type: 'alphabetical',
  },
];

// Shared with scripts/check-function-ceiling.mjs.
export const globalIgnores = [
  '**/*.generated.*',
  '**/node_modules/',
  '**/dist/',
  '**/out/',
  '**/build/',
  '**/.react-router/',
  'apps/desktop/src-tauri/',
  '.claude/',
  'coverage/',
  '.playwright-mcp/',
  '.superpowers/',
  '.turbo/',
  'docs/',
  'playwright-report/',
  'test-results/',
];

// Readability rules only; formatting belongs to Prettier.
export default tseslint.config(
  {
    ignores: [...globalIgnores],
  },
  // Exceptions go through eslint-suppressions.json only, never inline comments.
  { linterOptions: { noInlineConfig: true } },
  {
    files: ['**/*.{ts,tsx,mts,cts}'],
    languageOptions: { parser: tseslint.parser },
  },
  ...tseslint.configs.recommended.map((config) => ({
    ...config,
    files: ['**/*.{ts,tsx,mts,cts}'],
  })),
  {
    files: ['apps/*/src/**/*.{ts,tsx}', 'packages/*/src/**/*.{ts,tsx}'],
    languageOptions: { parserOptions: { projectService: true } },
    rules: {
      '@typescript-eslint/await-thenable': 'error',
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
      '@typescript-eslint/switch-exhaustiveness-check': [
        'error',
        { considerDefaultExhaustiveForUnions: true },
      ],
    },
  },
  {
    files: ['**/*.{ts,tsx,mts,cts}'],
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', ignoreRestSiblings: true },
      ],
    },
  },
  {
    files: ['**/*.{js,cjs}'],
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
  {
    files: ['**/*.{ts,tsx,mts,cts,js,mjs,cjs}'],
    plugins: { '@stylistic': stylistic, perfectionist },
    rules: {
      '@stylistic/max-len': [
        'error',
        {
          code: 100,
          ignoreRegExpLiterals: true,
          ignoreStrings: true,
          ignoreTemplateLiterals: true,
          ignoreUrls: true,
        },
      ],
      '@stylistic/padding-line-between-statements': [
        'error',
        { blankLine: 'always', next: ['return', 'throw', 'break', 'continue'], prev: '*' },
        { blankLine: 'always', next: '*', prev: ['const', 'let', 'var'] },
        { blankLine: 'any', next: ['const', 'let', 'var'], prev: ['const', 'let', 'var'] },
        {
          blankLine: 'always',
          next: ['multiline-block-like', 'multiline-expression', 'function', 'class', 'try'],
          prev: '*',
        },
        {
          blankLine: 'always',
          next: '*',
          prev: ['multiline-block-like', 'multiline-expression', 'function', 'class'],
        },
        { blankLine: 'always', next: '*', prev: 'if' },
        { blankLine: 'any', next: 'if', prev: 'if' },
      ],
      'no-console': 'error',
      'perfectionist/sort-interfaces': ['error', ...sortOptions],
      'perfectionist/sort-jsx-props': ['error', ...sortOptions],
      'perfectionist/sort-object-types': ['error', ...sortOptions],
    },
  },
  {
    files: ['**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks },
    rules: {
      'react-hooks/exhaustive-deps': 'error',
      'react-hooks/rules-of-hooks': 'error',
    },
  },
  {
    files: ['scripts/**', 'apps/*/scripts/**', 'packages/*/scripts/**'],
    rules: { 'no-console': 'off' },
  },
  {
    // The webview host has no other channel to say why the PDF reader script failed to load.
    files: ['apps/vscode/src/webview/client/host/createWebviewWorker.ts'],
    rules: { 'no-console': ['error', { allow: ['warn'] }] },
  },
  {
    files: ['**/catalog/**/content.ts', '**/shaders.ts'],
    rules: { '@stylistic/max-len': 'off' },
  },
  {
    files: ['**/*.{ts,tsx,mts,cts,js,mjs,cjs}'],
    rules: {
      eqeqeq: ['error', 'always'],
      'max-depth': ['error', 4],
      'max-lines': ['error', { max: 400, skipBlankLines: true, skipComments: true }],
      'max-lines-per-function': ['error', { max: 60, skipBlankLines: true, skipComments: true }],
      'no-nested-ternary': 'error',
    },
  },
  {
    files: [
      '**/test/**',
      '**/tests/**',
      '**/*.test.{ts,tsx}',
      '**/*.spec.ts',
      '**/catalog/**/content.ts',
    ],
    rules: {
      eqeqeq: 'off',
      'max-depth': 'off',
      'max-lines': ['error', { max: 800, skipBlankLines: true, skipComments: true }],
      'max-lines-per-function': 'off',
      'no-nested-ternary': 'off',
    },
  },
);

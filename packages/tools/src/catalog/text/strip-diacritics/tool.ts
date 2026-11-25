import { ToolDefinition, ToolError } from '@devtoolora/core';
import { encodeBase64Text } from '@devtoolora/functions/encoding';
import {
  compareTextLines,
  stripDiacriticsDetailed,
  type TextDiffResult,
} from '@devtoolora/functions/text';
import { withToolError } from '../../../adapters/errors';

const defaults: Record<string, string> = { preview: 'changes', scope: 'latin' };

export const stripDiacriticsTool: ToolDefinition = {
  capabilities: ['browserWorker', 'browserMain', 'vscode', 'desktop'],
  category: 'Text',
  description:
    'Remove selected combining accents with explicit Unicode scope, preserve untargeted scripts and emoji, and inspect the result without assuming ASCII transliteration.',
  fields: [
    {
      defaultValue: 'latin',
      help: 'Latin removes Mark + Diacritic characters following a Latin letter in canonical decomposition. Combining diacritics applies that intersection to every script. All combining marks removes every Unicode Mark, including vowel signs, selectors and keycap marks.',
      id: 'scope',
      label: 'Removal scope',
      options: [
        { label: 'Latin accents', value: 'latin' },
        { label: 'Combining diacritics', value: 'diacritics' },
        { label: 'All combining marks', value: 'marks' },
      ],
      presentation: 'segmented',
      type: 'select',
    },
    {
      defaultValue: 'changes',
      id: 'preview',
      label: 'Preview',
      options: [
        { label: 'Changes', value: 'changes' },
        { label: 'Result text', value: 'text' },
        { label: 'JSON audit', value: 'report' },
      ],
      presentation: 'segmented',
      type: 'select',
    },
  ],
  id: 'strip-diacritics',
  inputKind: 'optionalText',
  keywords: ['diacritics', 'accents', 'unicode', 'marks', 'latin', 'normalization'],
  name: 'Strip Diacritics',
  outputKind: 'text',
  relatedToolIds: ['case-convert', 'slugify', 'text-diff', 'zero-width-detector'],
  resultActions: ['replace', 'insert', 'copy', 'scratch', 'save'],
  run: ({ fields, text }) => {
    const scope = fields.scope ?? 'latin';
    const preview = fields.preview ?? 'changes';

    if (scope !== 'latin' && scope !== 'diacritics' && scope !== 'marks')
      throw new ToolError('Choose Latin accents, Combining diacritics or All combining marks.');
    if (preview !== 'changes' && preview !== 'text' && preview !== 'report')
      throw new ToolError('Choose Changes, Result text or JSON audit.');

    const result = withToolError(() => stripDiacriticsDetailed(text, { scope }));
    let comparison: TextDiffResult | undefined;
    let comparisonUnavailable: string | undefined;

    try {
      comparison = withToolError(() => compareTextLines(text, result.text));
    } catch (error) {
      if (
        !(error instanceof ToolError) ||
        !/comparison budget|Ambiguous diff|limited to 100,000 UTF-16 units|limited to 10,000 physical lines/.test(
          error.message,
        )
      )
        throw error;

      comparisonUnavailable = error.message;
    }

    const report = JSON.stringify(
      { comparison, comparisonUnavailable, originalText: text, result, scope },
      null,
      2,
    );
    const textArtifact = {
      base64: encodeBase64Text(result.text),
      fileName: 'stripped-text.txt',
      mimeType: 'text/plain;charset=utf-8',
    };
    const reportArtifact = {
      base64: encodeBase64Text(report),
      fileName: 'diacritics-report.json',
      mimeType: 'application/json;charset=utf-8',
    };

    return {
      artifact: preview === 'report' ? reportArtifact : textArtifact,
      artifacts: [preview === 'report' ? textArtifact : reportArtifact],
      language: preview === 'report' ? 'json' : 'plaintext',
      resultActions: preview === 'report' ? ['copy', 'scratch', 'save'] : undefined,
      summary: `${result.text === text ? 'Unchanged' : 'Stripped'} · ${result.removedMarks} decomposed marks removed · ${result.changedGraphemes} source graphemes changed · ${result.inputCodePoints} → ${result.outputCodePoints} code points · ${result.nonAsciiCodePoints === 0 ? 'ASCII output' : `${result.nonAsciiCodePoints} non-ASCII code points remain`}.${scope !== 'latin' ? ' Broad scope can change other scripts or emoji presentation.' : ''}${comparisonUnavailable ? ' Comparison unavailable; exact result and reason are in the audit.' : ''}`,
      text: preview === 'report' ? report : result.text,
      textDiff:
        preview === 'changes' && comparison
          ? { layout: 'split', rows: comparison.rows }
          : undefined,
    };
  },
  samples: [
    {
      fields: { ...defaults },
      label: 'Czech and French accents',
      text: 'Příliš žluťoučký kůň\nCrème brûlée déjà vu\n',
    },
    {
      fields: { ...defaults },
      label: 'Composed and decomposed accents',
      text: 'café\ncafe\u0301\n',
    },
    { fields: { ...defaults }, label: 'Extended combining accent', text: 'a\u1AB0\n' },
    {
      fields: { ...defaults },
      label: 'Keep other scripts unchanged',
      text: 'Café / α\u0301 / عَرَبِيّ / क् / 가',
    },
    { fields: { ...defaults }, label: 'Keep emoji presentation', text: 'é ♥️ 1️⃣ 👨‍👩‍👧‍👦 👍🏽' },
    {
      fields: { ...defaults },
      label: 'Not an ASCII transliterator',
      text: 'Łódź Straße smør æsir Œuvre ﬁ',
    },
    {
      fields: { ...defaults, scope: 'diacritics' },
      label: 'Broader combining diacritics',
      text: 'ά عَرَبِيّ क् ♥️ 1️⃣',
    },
    {
      fields: { ...defaults, scope: 'marks' },
      label: 'All marks can alter emoji',
      text: 'é ♥️ 1️⃣ 👨‍👩‍👧‍👦 👍🏽',
    },
    { fields: { ...defaults }, label: 'Keep mixed line endings', text: 'čaj\r\ncafé\rkůň\n' },
    {
      fields: { ...defaults, scope: 'diacritics' },
      label: 'Detached marks become empty',
      text: '\u0301\u0308',
    },
    {
      fields: { ...defaults, preview: 'report' },
      label: 'Full diacritic audit',
      text: 'café / cafe\u0301 / Ł\n',
    },
    { fields: { ...defaults }, label: 'Empty input is valid', text: '' },
  ],
  supportsSelection: true,
  freshResults: true,
};

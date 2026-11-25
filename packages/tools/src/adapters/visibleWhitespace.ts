import type { TextDiffLine } from '@devtoolora/functions/text';

const whitespaceMarkers: Record<string, string> = {
  '\t': '↹',
  ' ': '·',
};

// Preview-only markers: space ·, tab ↹, and ⍽ for no-break spaces.
export function visibleLine(line: TextDiffLine | undefined): TextDiffLine | undefined {
  if (!line) return undefined;

  return {
    ...line,
    text: line.text.replace(
      /[ \t\u00A0\u202F]/g,
      (character) => whitespaceMarkers[character] ?? '⍽',
    ),
  };
}

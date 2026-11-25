import type { ToolContent } from '@devtoolora/core';

export const content: ToolContent = {
  documentation: [
    {
      content: [
        'Wrapping inserts actual line terminators, not just visual soft wrapping in an editor. Each existing physical line is processed independently, with its original final terminator preserved.',
        'Unwrapping replaces eligible internal line terminators with a space or no separator. Paragraph boundaries and final terminators are preserved by default.',
        'Width counts Unicode grapheme clusters: a combining-accent character or joined emoji can count as one unit. This is not pixel width, terminal columns or a tab-stop calculation.',
      ],
      title: 'What is text wrapping?',
    },
    {
      content: [
        'Prepare plain-text prose for a chosen grapheme width.',
        'Join hard-wrapped copied text without losing blank paragraph separators.',
        'Inspect line-ending changes or explicitly choose the endings of newly inserted breaks.',
        'Keep long URLs intact, or deliberately split long tokens without cutting Unicode grapheme clusters.',
      ],
      title: 'When to use Wrap/Unwrap Text',
    },
  ],
  examples: [
    'Width 10: one two three → one two / three.',
    'Width 10 with indentation: "  one two three four" → "  one two" / "  three" / "  four".',
    'Keep long tokens: abcdef at width 3 → abcdef, reported as over-width. Break long tokens → abc / def.',
    'Width 12: well-known hyphen-ated words here → well-known / hyphen-ated / words here; hyphens are not break points.',
    'Unwrap with paragraphs kept: one / two / blank / three / four → one two / blank / three four.',
    'Unwrap, No separator, Collapse spacing: https://example. / "  test/path" → https://example.test/path.',
  ],
  faq: [
    {
      answer:
        'Width counts grapheme clusters, so an emoji sequence, an accented letter and a tab each count as one. It does not measure pixels or terminal columns, so wide CJK characters can look longer than the limit.',
      question: 'Does the width count characters, columns or pixels?',
    },
    {
      answer:
        'Run Unwrap first to join its lines, then run Wrap on that result with the new width. Wrap alone keeps existing line breaks and only splits lines that are too long.',
      question: 'How do I reflow a paragraph that is already hard-wrapped?',
    },
    {
      answer:
        'Not by default: Keep intact leaves a long token on its own over-width line, and the summary counts it. Choose Break by grapheme to split it, so abcdef at width 3 → abc / def.',
      question: 'Will it break long URLs or words?',
    },
    {
      answer:
        'No. Only ASCII spaces and tabs are break points, so well-known and hyphen-ated stay whole at width 12. Text without spaces, such as Chinese, is one token unless you choose Break by grapheme.',
      question: 'Does it break lines at hyphens?',
    },
    {
      answer:
        'Choose Unwrap. With Keep paragraphs, one / two / blank / three / four → one two / blank / three four; Join all lines also merges across blank lines.',
      question: 'How do I join lines into one paragraph?',
    },
    {
      answer:
        'Yes. Leading spaces and tabs are repeated on each continuation line, so “  one two three four” at width 10 → “  one two” / “  three” / “  four”. List markers such as - are not treated as hanging indents.',
      question: 'Is indentation kept on wrapped lines?',
    },
  ],
  help: 'Paste text or apply a complete sample. Empty and whitespace-only inputs are valid.\n\nWrap: choose width, long-token behavior and inserted line endings. Existing hard line boundaries stay; to reflow an already wrapped paragraph, unwrap it first and use that result as the next input.\n\nUnwrap: choose paragraph boundaries and join separator. Width, long-token and inserted-ending draft settings are hidden and ignored.\n\nChoose Preserve spacing or the explicit ASCII spacing cleanup. Inspect Changes before replacing input: joining and gap replacement can alter prose, Markdown or code semantics.\n\nRun and save reflowed-text.txt for exact output. JSON audit exports original text, output, settings, break counts and available comparison as reflow-report.json. Samples reset all eight settings.',
  notes: [
    'Wrapping processes each physical line independently. It does not automatically merge earlier hard wraps, parse paragraphs or preserve Markdown list markers as hanging indentation. Leading ASCII indentation is repeated on each continuation.',
    'Normal break opportunities are ASCII spaces/tabs. NBSP, narrow NBSP, zero-width characters and non-ASCII line separators are not treated as horizontal break gaps. CJK text without ASCII gaps is one token; opt-in long-token breaking may split it or a token containing NBSP.',
    'Preserve does not mean byte-identical whitespace at a break: the entire horizontal gap selected for wrapping is replaced by an inserted terminator. Other horizontal runs, indentation, trailing padding and blank bodies are retained. Collapse intentionally reduces ASCII interior spacing and eligible trailing/join edges.',
    'Unwrap Preserve replaces only eligible internal terminators and retains both neighboring bodies, including indentation and trailing spaces. It can therefore produce multiple adjacent spaces. Collapse keeps the first row’s indentation but trims continuation/join-edge ASCII spacing.',
    'A paragraph separator is empty or only ASCII spaces/tabs. Keep preserves those rows and their raw terminators. Join all is an explicit operation across blank separators; an empty row adds no separator of its own, so one / blank / two → one two. Final terminators are never replaced with trailing spaces.',
    'Original CRLF, CR and LF spellings survive except internal terminators explicitly joined by Unwrap. Inserted-ending settings never normalize existing terminators. A final newline is not an extra empty physical row.',
    'Width counts grapheme clusters using Intl.Segmenter. A tab counts as one, not an expanded tab stop; wide CJK glyphs and emoji need not occupy one terminal column. Segmentation depends on runtime Unicode data; no UTF-16 splitting fallback is used.',
    'Keep long tokens, retained indentation, trailing padding and blank rows can produce over-width output. The summary counts these lines. Break mode errors if indentation alone consumes the available width, and does not trim trailing padding to force a width limit.',
    'Input is limited to 100,000 UTF-16 units and 10,000 physical lines, width to 1–1,000, output to 1,000,000 UTF-16 units. NUL, unpaired surrogates and invalid active settings are rejected without truncation. Generated output can exceed a later run’s input budget.',
    'Untouched samples and VS Code source drafts retain raw terminators. User-edited browser textareas normalize line endings to LF and that edited text becomes the actual input.',
    'Changes initially shows 100 aligned rows. If text/line/diff limits prevent comparison, wrapping still succeeds with exact output; the audit explains why the visual comparison is unavailable. No diff markers or summary footer enter the TXT export.',
    'Wrap and Unwrap are not guaranteed inverses. Hyphenation, sentence boundaries, code syntax, Markdown hard breaks and display width are not inferred. The audit contains your original text as well as the result.',
  ],
};

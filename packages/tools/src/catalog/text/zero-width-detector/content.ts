import type { ToolContent } from '@devtoolora/core';

export const content: ToolContent = {
  documentation: [
    {
      content: [
        'Invisible and formatting characters can affect word breaks, glyph selection, script joining, mathematical meaning or bidirectional display without appearing as ordinary printed letters.',
        'This inspector detects a curated set, not every invisible-looking Unicode character. Detect never changes source. Removal defaults to only U+200B ZERO WIDTH SPACE and U+FEFF BOM/zero-width no-break space.',
        'Joiners, variation selectors, emoji tags and bidi controls can be meaningful. They are shown by name and location and are not removed by the default cleanup scope.',
      ],
      title: 'What are zero-width and formatting characters?',
    },
    {
      content: [
        'Locate hidden characters in pasted identifiers or text with unexpected matching behavior.',
        'Inspect a BOM or zero-width space before deciding whether to remove it.',
        'Review joiners, variation selectors and bidirectional controls without blindly deleting them.',
        'Create an audit with original source positions and a separate exact cleaned TXT.',
      ],
      title: 'When to use Zero-Width Character Detector',
    },
  ],
  examples: [
    'zero + U+200B + width is shown as zero[ZWSP]width in context; default cleanup produces zerowidth.',
    'U+FEFF + hello → one BOM record at UTF-16 offset 0, line 1, column 1; Detect does not trim it.',
    '😀 + U+200B → the hidden character is reported at UTF-16 offset 2 but code-point offset 1.',
    '👨‍👩‍👧‍👦 → three ZWJ records; default removal keeps the family, while Joining controls removal gives 👨👩👧👦.',
    '♥️ (♥ + VS16) with Variation selectors + tags removal → text-style ♥.',
  ],
  faq: [
    {
      answer:
        'Paste the text and run Detect. Each found character is listed with its code point, name, UTF-16 offset, line, column and a context such as zero[ZWSP]width; the source is not changed.',
      question: 'How do I find hidden characters in my text?',
    },
    {
      answer:
        'No. Zero-width joiners build emoji such as 👨‍👩‍👧‍👦 and shape some scripts, and variation selectors choose emoji style. The default removal scope deletes only ZWSP and BOM; wider scopes can split emoji or change text.',
      question: 'Is it safe to remove every zero-width character?',
    },
    {
      answer:
        'No. NBSP, tabs and other ordinary or Unicode spaces are outside the detected set. Use Whitespace Cleaner, which marks NBSP as ⍽ and can replace it with Normalize Unicode spaces.',
      question: 'Does it detect non-breaking spaces?',
    },
    {
      answer:
        'Detect reports U+FEFF as ZERO WIDTH NO-BREAK SPACE / BOM, at offset 0 when it starts the text. Switch to Remove with the ZWSP + BOM only scope to delete it; that scope also deletes U+200B zero-width spaces.',
      question: 'How do I remove a byte-order mark (BOM)?',
    },
    {
      answer:
        'It reports the bidi controls U+202A–U+202E and U+2066–U+2069 plus the LRM, RLM and ALM marks with their positions, and the Bidi controls scope removes them. It does not judge whether text is malicious.',
      question: 'Can it find Trojan Source bidirectional control characters?',
    },
    {
      answer:
        'Only partly. Break/layout controls also removes ZWSP and BOM, Variation selectors + tags covers tag characters, and All detected characters removes the whole set; Joining controls and Bidi controls remove only their own group.',
      question: 'Do the removal scopes include each other?',
    },
  ],
  help: 'Paste text or choose a sample. Detect is the default and does not remove anything, including a leading BOM.\n\nCharacter table shows names, categories, escaped contexts and original positions. Search filters visible rows; Show more reveals another page. The report always contains every accepted detection.\n\nIndices and exclusive ends are zero-based UTF-16 offsets; code-point offsets are also zero-based. Lines and columns are one-based, with columns counted in UTF-16 units and CRLF counted as one line break.\n\nSwitch to Remove, choose a scope and inspect Labeled changes. Common cleanup removes only ZWSP/BOM and can still join words; wider scopes may change emoji, script shaping, line breaks or math.\n\nSave invisible-characters.json for the audit or cleaned-invisibles.txt for raw cleaned text. JSON audit cannot replace source text. Changing input or settings invalidates old exports; samples reset all four fields.',
  notes: [
    'Declared set: U+00AD, U+034F, U+061C, U+180B–U+180F, U+200B–U+200F, U+202A–U+202E, U+2060–U+2064, U+2066–U+2069, U+FE00–U+FE0F, U+FEFF, U+E0001, U+E0020–U+E007F and U+E0100–U+E01EF.',
    'This is not a complete Default_Ignorable_Code_Point, Unicode Format or confusable-character scanner. Ordinary spaces, tabs, NBSP, Braille blank, Hangul fillers, line separators and unlisted controls are not reported. No detections does not prove text is safe or free of invisible-looking glyphs.',
    'Not every reported character is always zero-width. Soft hyphen can become visible at a line break; variation selectors and tags modify another glyph; mathematical controls can carry meaning. Rendered behavior depends on fonts, shaping and context.',
    'Detect ignores inactive removal settings and preserves source exactly. Remove still reports every detected category; each original record says whether it was removed. Positions always refer to the original source, not shifted output offsets.',
    'Common scope removes only ZWSP and U+FEFF at any location. Layout scope additionally removes SHY and WJ. Joining scope covers CGJ, MVS, ZWNJ and ZWJ. Bidi scope covers the declared directional marks/embeddings/overrides/isolates. Selector scope also includes declared tag controls. All means the declared set only.',
    'No deletion scope is universally safe. ZWSP can separate words, BOM may have deprecated joining use, CGJ affects mark ordering, ZWJ/ZWNJ can shape scripts or emoji, and selectors/tags can select meaningful glyph presentation.',
    'Bidi control removal is not proof against spoofing, malformed embedding state or confusable identifiers. The inspector does not evaluate directional pairing or produce a security verdict. Review the full source and destination requirements.',
    'Contexts show up to 12 UTF-16 units on each side, expanded to avoid splitting surrogate pairs. Detected characters become bracketed labels and CR/LF/tab become visible backslash sequences. Literal labels in source can look similar; use recorded offsets and code points to disambiguate.',
    'JSON audit escapes every declared control as UTF-16 \\u sequences, including surrogate pairs for supplementary selectors/tags. Parsing the JSON restores exact original data while its displayed strings do not execute those formatting controls.',
    'Labeled changes marks retained controls too and intentionally omits intra-line highlights whose offsets would shift with labels. The TXT never contains these labels. Cleaned text is actual output and can still contain meaningful retained formatting controls.',
    'Input is limited to 100,000 UTF-16 units and 10,000 detections. NUL and unpaired surrogates are rejected. Exceeding a limit rejects the complete operation, not a partial audit or cleanup. Output cannot grow because removal never inserts or normalizes characters.',
    'Raw spaces, tabs, CR, LF, CRLF, Unicode spelling and absence of a final newline remain unless a declared character itself is removed. Removing a character between CR/LF or an unterminated invisible-only body can change physical line interpretation; the summary warns when counts differ. Untouched samples and VS Code source drafts retain raw terminators; edited browser textareas normalize newlines to LF.',
    'The table starts with 100 records and its search does not alter exports. If line-diff limits prevent a cleanup comparison, removal still returns exact output and the audit explains why comparison is unavailable.',
  ],
};

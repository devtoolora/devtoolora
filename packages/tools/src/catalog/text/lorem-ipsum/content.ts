import type { ToolContent } from '@devtoolora/core';

export const content: ToolContent = {
  documentation: [
    {
      content: [
        'Lorem Ipsum is Latin-style placeholder text used to inspect a layout before its final copy is ready. It helps reveal wrapping, paragraph spacing and content density without distracting you with meaningful prose.',
        'This generator cycles through 20 bundled sentences. Identical settings produce identical output, so layout comparisons are reproducible. The text is filler, not a translation, a Latin language exercise or randomly generated unique prose.',
      ],
      title: 'What is Lorem Ipsum?',
    },
    {
      content: [
        'Fill cards, article columns and design prototypes with a controlled amount of text.',
        'Compare short and long content states or paragraph spacing.',
        'Create repeatable local fixtures for wrapping and overflow checks.',
        'Replace it with real copy before evaluating comprehension, localization, accessibility of language or final content hierarchy.',
      ],
      title: 'When to use Lorem Ipsum',
    },
  ],
  examples: [
    '5 words → Lorem ipsum dolor sit amet,',
    '6 sentences with 5 per paragraph → two paragraphs, containing five sentences and one sentence.',
    '3 paragraphs with 2 sentences each → exactly three paragraphs and six complete sentences.',
    'HTML output → a paragraph fragment using <p> elements, not an entire HTML page.',
    'Markdown output → paragraphs separated by a blank LF line, ready for a Markdown document.',
  ],
  faq: [
    {
      answer:
        'No. It cycles through a fixed bank of 20 sentences, so the same settings always produce the same text. That keeps layout comparisons and test fixtures repeatable.',
      question: 'Is the generated text different every time?',
    },
    {
      answer:
        'Up to 5,000 words, 100 sentences or 50 paragraphs of 1–10 sentences each. Larger values show an error instead of being reduced silently.',
      question: 'How much text can I generate at once?',
    },
    {
      answer:
        'Yes. Choose HTML source to get one <p> element per paragraph, separated by newlines, such as <p>Lorem ipsum dolor sit amet, consectetur adipiscing elit.</p>. It is a fragment, not a complete HTML page.',
      question: 'Can I get the paragraphs as HTML?',
    },
    {
      answer:
        'Words mode stops at exactly the requested number of words and keeps punctuation attached to them, so 5 words → “Lorem ipsum dolor sit amet,” with the comma. No period is added.',
      question: 'Why does Words mode stop in the middle of a sentence?',
    },
    {
      answer:
        'Not as used here. The sentences are Latin-like filler meant to look like text; they are not a translation or meaningful prose. Replace them with real copy before judging readability or translated text length.',
      question: 'Does Lorem Ipsum mean anything?',
    },
  ],
  help: 'Choose Words, Sentences or Paragraphs and enter a whole-number Amount.\n\nFor sentences and paragraphs, choose the number of sentences per paragraph. Words mode produces one paragraph and can stop partway through a sentence.\n\nUse Start with Lorem ipsum for the classic opening. Turning it off changes the starting sentence, not the amount.\n\nPreview shows normal paragraph typography. Copy and Save still use the underlying plain text. Choose Plain text, Markdown or HTML source to inspect that export format.\n\nGeneration updates locally when settings change. Apply a sample to restore all settings. Invalid values show an error rather than silently rounding or changing your request.\n\nCopy, insert into an editor or save the generated content. The summary stays separate and is never added to the exported text.',
  notes: [
    'Runs locally with a bundled sentence bank. It does not fetch text, use AI or add random variation.',
    'Amount limits are 5,000 words, 100 sentences or 50 paragraphs; each paragraph supports 1–10 sentences. These are independent unit limits, not a hidden output truncation.',
    'Words are whitespace-delimited tokens, including attached punctuation. Word mode can end with a comma or without a full stop; it does not invent a sentence terminator or an extra word.',
    'Sentence counts are complete period-terminated bundled sentences. Paragraph mode returns the exact requested paragraph count. The last paragraph can be shorter in Sentence mode.',
    'Plain text and Markdown share the same valid paragraph text, separated by two LF characters, with no added trailing newline. Only their filename and MIME type differ.',
    'HTML export is a <p> fragment with LF between paragraphs, not a standalone page or a template with custom markup. Preview and text exports contain no summary footer.',
    'Content repeats after the 20-sentence bank. Turning off the classic opening changes the start only; it does not exclude that sentence from later repetitions.',
    'Latin-style filler does not model Czech diacritics, emoji, long identifiers, right-to-left writing or real translated copy. Use representative real strings for those tests.',
  ],
};

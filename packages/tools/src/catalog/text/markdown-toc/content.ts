import type { ToolContent } from '@devtoolora/core';

export const content: ToolContent = {
  documentation: [
    {
      content: [
        'The Markdown TOC tool reads the headings of a Markdown document and writes a nested list of links to them. It runs locally in your browser or editor, so your document never leaves your machine.',
        'Both heading styles are understood: lines starting with hash marks, and text underlined with equals signs or dashes. Headings inside fenced code blocks and indented code are ignored.',
      ],
      title: 'What does Markdown TOC do?',
    },
    {
      content: [
        'Anchors follow the GitHub rules: lowercase, punctuation removed, spaces turned into hyphens. Repeated headings get a numeric suffix such as intro-1, in document order.',
        'Links, images, emphasis and HTML tags inside a heading are reduced to their text before the anchor is made, so a linked heading still gets a clean anchor. YAML front matter at the top of the file is skipped.',
      ],
      title: 'Anchors and levels',
    },
  ],
  examples: [
    '## Intro, ### Setup → - [Intro](#intro) with a nested - [Setup](#setup)',
    'Two headings called Intro → #intro and #intro-1',
    '## Closing ## → - [Closing](#closing)',
    'Numbered style → 1. [A](#a) with nested 1. [B](#b)',
  ],
  faq: [
    {
      answer:
        'The shallowest and deepest heading levels decide which headings are listed. The default is levels 2 and 3, which leaves out the page title. Change them to match your document.',
      question: 'Which headings are included?',
    },
    {
      answer:
        'Headings are counted in document order, including headings outside the chosen range, as GitHub does. The first keeps the plain anchor and later ones get -1, -2 and so on.',
      question: 'How are duplicate headings handled?',
    },
    {
      answer:
        'Nesting is based on the heading level minus the shallowest level listed. Bullet lists indent by two spaces and numbered lists by three, so the result renders correctly.',
      question: 'How is the list nested?',
    },
    {
      answer:
        'GitHub and most renderers use the same anchor rules, but some tools differ, for example with non-Latin letters. Check the links once in your target renderer.',
      question: 'Will the links work everywhere?',
    },
  ],
  help: 'Paste a Markdown document and pick the heading levels to include.\n\nChoose a dash, asterisk or numbered list style.\n\nThe result is a nested list of links using GitHub style anchors.\n\nCode blocks are skipped, and duplicate headings get numbered anchors.\n\nThe summary shows how many headings were listed.',
  notes: [
    'Input is limited to 1,000,000 characters.',
    'The minimum level must not exceed the maximum level.',
    'Headings with no text are skipped.',
  ],
};

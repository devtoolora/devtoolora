import type { ToolContent } from '@devtoolora/core';

export const content: ToolContent = {
  documentation: [
    {
      content:
        'Markdown uses readable text markers for headings, lists and other structure. PDF stores a paginated document that is convenient to print or share without an editable Markdown source.\n\nThis converter supports ATX headings (# through ######), ordinary text lines, flat ordered/unordered lists, blockquotes and fenced code blocks. It is a deliberately limited text renderer, not a browser or a complete CommonMark implementation.\n\nBundled Noto Sans Latin and Latin Extended fonts include Czech diacritics. Text is normalized to NFC and wrapped by measured font width. Unsupported writing systems or emoji produce an explicit error, not missing-glyph boxes.',
      title: 'What is Markdown to PDF?',
    },
    {
      content: [
        'Export short release notes, checklists and text-based project summaries.',
        'Print a local document with Czech or other Latin-script text without uploading it.',
        'Share a paginated text document while keeping the original Markdown separately for editing.',
      ],
      title: 'When to use Markdown to PDF',
    },
  ],
  examples: [
    '# Release notes → a bold 24 pt heading at the default 11 pt body size; ## Highlights → a 22 pt heading.',
    '- Offline processing → • Offline processing, indented as a list item.',
    '1. Read input → 1. Read input, with the number kept as typed.',
    '> Review before publishing → indented text with a gray bar on the left.',
    '**bold** and [docs](https://example.com) → printed literally, with the asterisks and brackets.',
    'Příliš žluťoučký kůň → drawn with the bundled Noto Sans Latin Extended glyphs instead of failing in a WinAnsi-only font.',
    'Text that needs two pages → footers 1 / 2 and 2 / 2, centered at the bottom.',
    '🙂 → error: Unsupported character U+1F642.',
  ],
  faq: [
    {
      answer:
        'The converter handles block structure only: headings, paragraphs, lists, blockquotes and fenced code. Remove the inline markers before converting, or convert with Markdown to HTML and print from a browser when you need formatting.',
      question: 'Why are **bold**, links and tables printed as plain text?',
    },
    {
      answer:
        'The bundled Noto Sans fonts cover Latin and Latin Extended letters only. Emoji, Cyrillic, Greek, CJK and similar characters are refused instead of printing empty boxes; the code point in the message tells you which character to remove or replace.',
      question: 'Why do I get “Unsupported character U+…”?',
    },
    {
      answer:
        'No. Every page gets a small centered gray footer such as 2 / 5, counting all pages of the generated PDF, and there is no setting to change or hide it.',
      question: 'Can I change the page number format or turn it off?',
    },
    {
      answer:
        'Yes. Text is drawn with embedded subsets of Noto Sans, not as images, so you can select, copy and search it in a PDF viewer. The file is not tagged for screen readers.',
      question: 'Is the text in the PDF selectable and searchable?',
    },
    {
      answer:
        'The bundled Noto Sans fonts are licensed under the SIL Open Font License, so the license text travels with the PDF as the attachment Noto-Sans-OFL.txt. It does not appear on the pages or affect printing.',
      question: 'Why does the PDF contain an attached file?',
    },
    {
      answer:
        'Title comes from Document title, Creator is Dev Toolora, and pdf-lib sets the Producer and the creation and modification dates. Use PDF Metadata Viewer & Editor afterwards to add an author, subject or keywords.',
      question: 'What metadata does the generated PDF have?',
    },
  ],
  help: 'Paste Markdown or apply a complete sample. Use the supported block syntax described below; other syntax remains literal text.\n\nSet document metadata title, A4/Letter page size and body font size from 9–16 points.\n\nRun the converter. It wraps text, continues onto additional pages and adds page numbers. No images, links or fonts are fetched remotely.\n\nDownload document.pdf and inspect it in your PDF viewer before sharing. Keep the original Markdown; the PDF is not a round-trip editable source.',
  notes: [
    'The converter runs locally in the same shared worker on web, desktop and VS Code. Fonts are bundled, not fetched from a font CDN.',
    'Supported structure is a basic Markdown subset. Inline bold/italic, links, images, tables, raw HTML and setext headings remain literal text; there is no script execution or remote loading.',
    'Fenced code preserves spaces after tabs are expanded to four spaces. The bundled code font is proportional Noto Sans, not a monospace programming font.',
    'Fonts cover Latin and Latin Extended, not arbitrary Unicode. Unsupported characters are identified by Unicode code point. NFC combines decomposed Latin accents where possible.',
    'Document title is metadata, not an automatically inserted visible heading. Add a # heading in the input when you want one on the page.',
    'Input is limited to 50,000 raw characters and 100 pages; metadata title is limited to 200 characters without control characters.',
    'Body font size is an integer from 9–16 points. Headings are larger; text wraps to the printable width with 54-point margins and centered page numbers.',
    'Embedded fonts include an attached SIL Open Font License text. This tool does not generate tagged/accessible PDF, PDF/A, clickable links or a browser-perfect HTML rendering.',
  ],
};

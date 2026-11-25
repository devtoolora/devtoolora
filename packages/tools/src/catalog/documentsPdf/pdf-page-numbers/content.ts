import type { ToolContent } from '@devtoolora/core';

export const content: ToolContent = {
  documentation: [
    {
      content:
        'This tool stamps the pages of a PDF: page numbers such as “Page 3 of 12”, a header and footer, a diagonal text watermark such as DRAFT or CONFIDENTIAL, and an image watermark such as a logo. You can use any of them together.\n\nHeader and footer text can include {n} for the page number, {total} for the last number, {date} for today, {file} for the file name and {title} for the document title.\n\nText is drawn with the bundled Noto Sans font, so accents and Latin Extended letters such as č, ř, ő and ł work. Rotated pages get their text upright, as a reader shows them.',
      title: 'What does the PDF stamp tool add?',
    },
    {
      content: [
        'Number the pages of a report, thesis or contract before printing or sending it.',
        'Mark drafts and internal copies with a watermark so they are not mistaken for the final version.',
        'Add a confidentiality line, the document title or the date to every page.',
        'Put a company logo or an approval stamp image in the middle of every page.',
      ],
      title: 'When to stamp a PDF',
    },
  ],
  examples: [
    'Footer “Page {n} of {total}” on a 4-page file → Page 1 of 4 … Page 4 of 4, centered at the bottom.',
    'Pages “2-”, first number 1 → the cover stays clean and page 2 shows Page 1 of 3.',
    'Header “{title} · {date}” aligned left → Quarterly report · 2026-10-16 at the top left of every page.',
    'Watermark DRAFT at 18% opacity and 45° → a large, light diagonal word across the middle of each page.',
    'Header “Důvěrné” → accented letters are drawn with Noto Sans, not replaced.',
    'Watermark image logo.png at 40% width and 18% opacity → the logo appears faintly in the center of each page.',
    'Header “Page {page}” → an error, because {page} is not a placeholder; use {n}.',
  ],
  faq: [
    {
      answer:
        '{total} is the last number printed, not the PDF page count. With Pages set to 2- on a 10-page file and First number 1, pages 2 to 10 are numbered 1 to 9, so {total} is 9.',
      question: 'Why does {total} show fewer pages than my PDF has?',
    },
    {
      answer:
        'Partly. Use a footer such as ACME-{n} and set First number, for example 1001, to continue a sequence. Numbers are not zero-padded, so number 7 prints as ACME-7, not ACME-000007.',
      question: 'Can I add Bates numbers?',
    },
    {
      answer:
        'Today’s date on your device as YYYY-MM-DD, such as 2026-10-16. It is the day you stamp the file, not the creation date stored in the PDF.',
      question: 'Which date format does {date} use?',
    },
    {
      answer:
        'No. Header and footer each hold one line, and line breaks are refused. Use both positions instead, for example {title} in the header and Page {n} of {total} in the footer.',
      question: 'Can the header or footer have two lines?',
    },
    {
      answer:
        'Text color and Watermark color take hex values such as #1f2328, #c62828 or the short form #333. Color names and rgb() values are refused.',
      question: 'Which colors can I use for the text and watermark?',
    },
    {
      answer:
        'Yes, with a PDF editor: the watermark is ordinary semi-transparent text or an image added on top of each page, not merged into the page content. It discourages casual reuse but is not a protection measure.',
      question: 'Can someone remove the watermark?',
    },
  ],
  help: 'Choose a PDF file. The footer starts as “Page {n} of {total}”; clear it if you only want a watermark.\n\nType a header, footer or watermark, or choose a PNG or JPEG watermark image, and pick left, center or right alignment. On the web and desktop the preview shows the first stamped pages and updates as you type.\n\nTo skip a cover page, set Pages to 2- and keep First number at 1. Adjust font size, margin and colors if needed.\n\nDownload the stamped PDF.',
  notes: [
    'Everything runs locally; the PDF never leaves your device.',
    'Stamps are added on top of the page as real text, so they can be selected and searched, and they do not change the original content.',
    'Long header or footer text is made smaller to fit between the margins, down to 6 pt, and the summary says so.',
    'Watermark size Auto fits the word diagonally on each page; a fixed size can run off narrow pages.',
    'A watermark image is drawn upright in the center of each page; Watermark opacity applies to it too. Transparent PNG areas stay transparent.',
    'The bundled fonts cover Latin and Latin Extended scripts. Emoji, Greek, Cyrillic, CJK and other scripts are refused with the character that failed.',
    'Encrypted or password-protected PDFs are refused, and stamping invalidates digital signatures.',
  ],
};

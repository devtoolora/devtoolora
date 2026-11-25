import type { ToolContent } from '@devtoolora/core';

export const content: ToolContent = {
  documentation: [
    {
      content:
        'PDF metadata is the information stored next to the pages: title, author, subject, keywords, the program that created the file (Creator), the program that wrote it (Producer) and the creation and modification dates. Readers show it in document properties, and the title often appears in the window and in search results.\n\nView shows what a file contains, including page count, size, PDF version, encryption and whether it also has an XMP metadata stream. Edit changes the fields you fill in. Remove all deletes every field and the XMP stream, which helps before sharing a file publicly.',
      title: 'What is PDF metadata?',
    },
    {
      content: [
        'Give an exported PDF a proper title instead of “Untitled” or a temporary file name.',
        'Check who and which software created a file before you publish or forward it.',
        'Strip names, internal paths and tool versions from a PDF before sharing it outside your organization.',
      ],
      title: 'When to view or edit metadata',
    },
  ],
  examples: [
    'View quarterly-report.pdf → title “Quarterly report”, author “Dev Toolora samples”, 4 pages, A4 portrait, PDF 1.7.',
    'Edit with Title “Q3 report 2026” → only the title changes; the author and dates stay.',
    'Edit with Subject “Finance” and Blank fields set to Clear → every other field is removed.',
    'Remove all → title, author, subject, keywords, creator, producer, dates and XMP are gone.',
    'Edit a file that has XMP metadata → the XMP stream is removed so readers show the new values, and the summary says so.',
  ],
  faq: [
    {
      answer:
        'No. Edit changes Title, Author, Subject, Keywords, Creator and Producer only. The creation and modification dates stay as they are, and Remove all deletes them together with every other field.',
      question: 'Can I change the creation or modification date?',
    },
    {
      answer:
        'Choose Edit, set Blank fields to Clear and type the values of the fields you want to keep; every field you leave empty is removed. With Keep current value, empty fields stay unchanged.',
      question: 'How do I remove only one field, such as Author?',
    },
    {
      answer:
        'Edit needs at least one new value, or Blank fields set to Clear while a field still has a value. Type a value, or switch Action to Remove all to delete everything.',
      question: 'Why does the tool say Nothing to change?',
    },
    {
      answer:
        'Creator names the application that made the original document, such as a word processor, and Producer names the program that wrote the PDF file, such as a PDF printer or library. Both are free text that you can change or clear.',
      question: 'What is the difference between Creator and Producer?',
    },
    {
      answer:
        'Each field takes up to 2,000 characters on one line; line breaks and other control characters are refused. Keywords are stored as one text value, so separate them with commas, such as finance, quarterly, 2026.',
      question: 'How long can a metadata value be?',
    },
    {
      answer:
        'No. Only the document information and the XMP stream change; pages, text and images are written back unchanged. The whole file is saved again, so its size can differ slightly, as the summary shows.',
      question: 'Does editing metadata change the pages?',
    },
  ],
  help: 'Choose a PDF file. View lists its current metadata and details straight away.\n\nSwitch to Edit and type the values to change. Leave a field blank to keep it, or set Blank fields to Clear to remove the ones you leave empty.\n\nChoose Remove all to delete every metadata field before sharing.\n\nDownload the updated PDF. The result lists the values before and after.',
  notes: [
    'Everything runs locally; the PDF never leaves your device.',
    'Editing does not add a pdf-lib Producer or change the dates unless you type them.',
    'Readers such as Acrobat prefer XMP metadata over the document information fields, so an existing XMP stream is removed when you edit or remove metadata.',
    'Remove all does not touch page content: names in the text, comments, form values or image EXIF data stay.',
    'Encrypted or password-protected PDFs show the page count and page details, with metadata null because its fields are encrypted, and cannot be edited.',
  ],
};

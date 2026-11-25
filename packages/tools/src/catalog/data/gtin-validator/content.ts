import type { ToolContent } from '@devtoolora/core';

export const content: ToolContent = {
  documentation: [
    {
      content:
        'Product and publication codes end in a check digit calculated from the other digits. GS1 codes (EAN-13, EAN-8, UPC-A, GTIN-14 and ISBN-13) weight the digits 3 and 1 from the right. ISBN-10 uses weights 10 down to 2 modulo 11, and ISSN uses weights 8 down to 2 modulo 11, with X standing for 10.\n\nThis tool detects the code type from its length and shape, recomputes the check digit and converts valid codes to their related formats, such as UPC-A to EAN-13 or ISBN-10 to ISBN-13.\n\nEverything runs locally in your browser. A valid result only means the code is well-formed, never that the product or book exists.',
      title: 'What is ISBN / EAN / UPC / GTIN Validator?',
    },
    {
      content: [
        'Check that a scanned or typed barcode was copied correctly before importing it into a catalog.',
        'Convert an ISBN-10 to ISBN-13, or pad a UPC-A or EAN-13 to the GTIN-14 form a marketplace asks for.',
        'Find which digit is wrong: the table shows the check digit the code should end with.',
      ],
      title: 'When to use ISBN / EAN / UPC / GTIN Validator',
    },
  ],
  examples: [
    '4006381333931 → EAN-13, valid, converts to GTIN-14 04006381333931.',
    '4006381333932 → EAN-13 with a wrong last digit; the expected check digit is 1.',
    '036000291452 → UPC-A, valid, converts to EAN-13 0036000291452.',
    '0-306-40615-2 → ISBN-10, valid, converts to ISBN-13 9780306406157.',
    '0378-5955 → ISSN, valid; the hyphen in the middle selects ISSN over EAN-8.',
    '0-8044-2957-X → ISBN-10 whose check character X stands for 10.',
  ],
  faq: [
    {
      answer:
        'No. The check digit only proves the code is well-formed. No registry is queried, so the product or book may not exist or may belong to nobody.',
      question: 'Does a valid result mean the product exists?',
    },
    {
      answer:
        'Eight digits are EAN-8 by default. A hyphen after the fourth digit or a trailing X marks an ISSN. You can also force the ISSN type from the Code type menu.',
      question: 'How does the tool tell an ISSN from an EAN-8?',
    },
    {
      answer:
        'Spaces and hyphens are removed. A letter is accepted only as an X in the last position of an ISBN-10 or ISSN. Any other character, including non-ASCII digits, makes the row Unknown and invalid.',
      question: 'Can I paste codes with hyphens or letters?',
    },
    {
      answer:
        'Only ISBN-13 codes starting with 978 have an ISBN-10 form. Codes starting with 979 were never assigned ISBN-10 numbers, so they convert only to GTIN-14.',
      question: 'Why is there no ISBN-10 for my ISBN-13?',
    },
  ],
  help: 'Paste one code per line. Spaces and hyphens are ignored and blank lines are skipped. Leave Code type on Auto to detect the type from the length, or pick a type to validate only that format.\n\nThe table shows the cleaned input, the detected type, whether the check digit matches, the check digit the code should have and, for valid codes, the equivalent formats.\n\nAn invalid row still shows the expected check digit when the length fits the type, so you can see which last digit would make it valid.\n\nCopy the table or save gtin-check.txt. Everything is computed locally and nothing is looked up online.',
  notes: [
    'Input is limited to 1,000 non-blank lines of at most 32 characters each, and 40,000 characters overall.',
    'Auto detection: 8 digits are EAN-8 (ISSN with a hyphen or trailing X), 10 characters ISBN-10, 12 digits UPC-A, 13 digits ISBN-13 when starting 978 or 979 else EAN-13, 14 digits GTIN-14.',
    'A forced type checks only that type: a wrong length is reported as invalid with no expected check digit. A forced ISBN-13 must also start with 978 or 979, so a valid EAN-13 such as 4006381333931 shows its check digit but is reported as invalid.',
    'Anything else, including other lengths, stray letters and non-ASCII digits, is shown as Unknown and never throws.',
    'Conversions are listed only for valid codes; ISSN and GTIN-14 have none, and ISBN-13 starting 979 converts only to GTIN-14.',
    'The tool checks structure only: no GS1 prefix ownership, registry group or product lookup is performed.',
  ],
};

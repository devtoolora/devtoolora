import type { ToolContent } from '@devtoolora/core';

export const content: ToolContent = {
  documentation: [
    {
      content:
        'A VAT number starts with a two-letter country prefix followed by a national body. Most countries add a check digit or check letter calculated from the other characters, so a mistyped number usually fails the checksum.\n\nThis tool normalizes each line, detects the country from the prefix (or uses the country you choose), checks the length and character layout and then runs the national checksum where one is implemented. Nine countries are checked for format only.\n\nEverything runs locally in your browser. A valid result only means the number is well-formed, never that the company is registered.',
      title: 'What is VAT Number Format Validator?',
    },
    {
      content: [
        'Catch typos in a customer VAT number before you submit an invoice or a VIES lookup.',
        'Clean a pasted list: separators and case are normalized and the failing rows show which part is wrong.',
        'Check a body-only number by forcing the country when the prefix is missing.',
      ],
      title: 'When to use VAT Number Format Validator',
    },
  ],
  examples: [
    'ATU13585627 → Austria, format ok, checksum pass.',
    'DE136695977 → Germany, format ok, checksum fail (the last digit is wrong).',
    'ES B12345678 → Spain, format ok, checksum not checked.',
    'CHE-123.456.788 MWST → Switzerland with the MWST suffix, checksum pass.',
    '136695976 with country DE → the prefix is optional when the country is forced.',
    'ZZ123 → unknown prefix ??, format bad.',
  ],
  faq: [
    {
      answer:
        'No. Only the format and checksum are checked. To know whether a company is registered you must query the official VIES service or your national register.',
      question: 'Does a valid result mean the company is registered?',
    },
    {
      answer:
        'Bulgaria, Cyprus, Greece, Spain, Lithuania, Latvia, Malta, Romania and Northern Ireland have no checksum here, so they show not checked. Some layouts of other countries, such as French letter keys, are also not checked.',
      question: 'Why does a row say the checksum was not checked?',
    },
    {
      answer:
        'Greece uses the prefix EL in VAT numbers, not GR. Northern Ireland uses XI, and Great Britain GB. Swiss numbers start with CHE and may end with MWST, TVA or IVA.',
      question: 'Which prefixes are special?',
    },
    {
      answer:
        'Letters, spaces, dots and hyphens are handled as separators or format errors per row, never as exceptions. Only ASCII digits count as digits, so other scripts make the format bad.',
      question: 'What happens with unusual characters?',
    },
  ],
  help: 'Paste one VAT number per line. Spaces, dots and hyphens are ignored, case does not matter and blank lines are skipped. Leave Country on Auto to read the prefix, or choose a country to validate bodies without a prefix.\n\nThe table shows the input, the detected country, whether the layout fits, the checksum verdict and the overall result. An unknown prefix is reported as country ?? with a bad format.\n\nA row is valid when the format is ok and the checksum did not fail. Countries without a checksum are valid on format alone.\n\nCopy the table or save vat-check.txt. Everything is computed locally and nothing is looked up online.',
  notes: [
    'The tool checks format and checksum only, not registration (VIES).',
    'Input is limited to 1,000 non-blank lines of at most 32 characters each, and 40,000 characters overall.',
    'Supported prefixes: AT BE BG CH CY CZ DE DK EE EL ES FI FR GB HR HU IE IT LT LU LV MT NL NO PL PT RO SE SI SK XI.',
    'Format only (checksum not checked): BG, CY, EL, ES, LT, LV, MT, RO and XI.',
    'Not checked layouts: Czech 9 and 10 digit numbers, French letter keys, GB GD and HA forms, and the old Irish digit-letter layout.',
    'Only ASCII digits are digits; anything else is a bad format row, and an unsupported forced country is rejected.',
  ],
};

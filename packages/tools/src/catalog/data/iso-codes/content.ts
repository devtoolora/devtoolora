import type { ToolContent } from '@devtoolora/core';

export const content: ToolContent = {
  documentation: [
    {
      content:
        'ISO publishes three small code systems that show up in almost every data model: ISO 3166-1 for countries, ISO 4217 for currencies and ISO 639 for languages. Each entry has a short alphabetic code, and countries and currencies also have a three-digit numeric code.\n\nThis tool holds all three tables, 249 countries, 178 currencies and 184 languages, and finds entries by code or by English name. Names come from the browser when it can provide them and from the built-in tables otherwise.\n\nEverything runs locally in your browser and nothing is looked up online.',
      title: 'What is Country, Currency & Language Codes?',
    },
    {
      content: [
        'Find the alpha-3 or numeric code that an API, a bank file or a database column expects.',
        'Check the number of minor units of a currency before you format or round an amount.',
        'Match the 639-1 and 639-2/B codes of a language when two systems disagree.',
      ],
      title: 'When to use Country, Currency & Language Codes',
    },
  ],
  examples: [
    'CZ → Czechia, CZE, 203.',
    'czech → the country, the Czech koruna and the Czech language.',
    '978 → the Euro (numeric code of EUR).',
    'JPY → 0 minor units, so amounts have no decimals.',
    'cs → Czech, ces, with 639-2/B cze.',
    'united → every country and currency whose name contains "united".',
  ],
  faq: [
    {
      answer:
        'A code must match exactly, ignoring case: alpha-2, alpha-3, numeric or the 639-2/B code. Anything else is searched as a part of the English name, so "cze" finds both the code and Czech names.',
      question: 'How does the search decide between a code and a name?',
    },
    {
      answer:
        'Some languages have two three-letter codes, a terminologic one (639-2/T) and a bibliographic one (639-2/B). The bibliographic code is shown in the detail column when it differs.',
      question: 'Why does a language have two three-letter codes?',
    },
    {
      answer:
        'Minor units are the number of decimals of a currency. Funds and metals such as XAU have no minor unit and show "no minor unit".',
      question: 'What does the detail column show for currencies?',
    },
    {
      answer:
        'Yes. Choose a kind and leave the input empty to list all of its entries. With the kind set to All, the empty query lists countries, currencies and languages in that order.',
      question: 'Can I list a whole table?',
    },
  ],
  help: 'Type a code or part of an English name and choose a kind, or leave the input empty to list a whole table. Case does not matter and surrounding spaces are ignored.\n\nCodes are matched exactly against the alpha-2, alpha-3, numeric and 639-2/B columns. Names are matched as a substring. Results are ordered by relevance: exact code matches first, then names equal to your text, then names that start with your text, then other name matches. Within each group countries come before currencies and languages.\n\nThe table shows the kind, both alphabetic codes, the numeric code, the name and a detail such as the minor units of a currency or the bibliographic language code.\n\nCopy the table or save iso-codes.txt. Everything is computed locally.',
  notes: [
    'Data covers 249 ISO 3166-1 countries, 178 ISO 4217 currencies and 184 ISO 639-1 languages.',
    'The query is limited to 256 characters.',
    'Results are capped at 1,000 rows, which the full list of 612 rows stays under.',
    'Codes match exactly and names match as a case-insensitive substring of the English name.',
    'Displayed names use the browser locale data when available and the built-in table otherwise.',
    'Historic and reserved codes, and languages without a two-letter code, are not included.',
  ],
};

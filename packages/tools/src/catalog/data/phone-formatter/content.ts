import type { ToolContent } from '@devtoolora/core';

export const content: ToolContent = {
  documentation: [
    {
      content:
        'A telephone number combines a country calling code with a national significant number. National display formats may add a trunk prefix, spaces or parentheses; those are not all part of the international identity.\n\nE.164-style output uses + followed by the calling code and significant digits. Extensions are separate: appending a desk extension to E.164 would change the number, so this tool keeps it in its own field and in the tel: URI.\n\nThis formatter uses bundled libphonenumber-js full metadata for length and digit-pattern checks. Valid means the number matches those rules, not that it is assigned, reachable or owned by anyone.',
      title: 'What is phone number formatting?',
    },
    {
      content: [
        'Normalize contact values before reviewing an import or building a form.',
        'Compare national display, international display and a machine-friendly E.164 value.',
        'Prepare a tel: link with an extension without losing the original phone identity.',
      ],
      title: 'When to format phone numbers',
    },
  ],
  examples: [
    'US (415) 555-0134 → +14155550134.',
    'CZ 601 123 456 → +420601123456.',
    'GB 020 7946 0018 → +442079460018, without the national trunk zero.',
    'IT 02 1234 5678 → +390212345678; Italy retains this significant zero.',
    '+44 20 7946 0018 overrides a US default country because + provides the calling code.',
    '+1 415 555 0134 ext. 123 → E.164 +14155550134 and tel:+14155550134;ext=123.',
  ],
  faq: [
    {
      answer:
        'E.164 is the international form: a plus sign, the country calling code and the national number without spaces or punctuation, such as +14155550134. This tool keeps any extension out of the E.164 value.',
      question: 'What is E.164 phone number format?',
    },
    {
      answer:
        'Only for national numbers such as (415) 555-0134. A number that starts with + carries its own calling code and overrides the default country; International only requires that leading +.',
      question: 'Do I need to choose a country?',
    },
    {
      answer:
        'The leading 0 in 020 7946 0018 is a domestic trunk prefix, not part of the number, so E.164 is +442079460018. Countries such as Italy keep a significant leading zero, and the bundled metadata handles that.',
      question: 'Why is the leading zero removed from UK numbers?',
    },
    {
      answer:
        'No. Valid means the length and digit pattern match the bundled libphonenumber metadata. Nothing is dialed, texted or looked up, so the number may still be unassigned or disconnected.',
      question: 'Does a valid result mean the number is in service?',
    },
    {
      answer:
        'Yes, when the prefix fits the default country: 00420 601 123 456 works with Czechia and 011 44 20 7946 0018 with the United States. A leading + is more portable because it does not depend on that setting.',
      question: 'Can I enter 00 or 011 international dialing prefixes?',
    },
    {
      answer:
        'No. Vanity letters such as 1-800-FLOWERS are rejected rather than mapped to keypad digits. Enter the numeric form instead.',
      question: 'Are letters in vanity numbers supported?',
    },
  ],
  help: 'Paste one complete number or apply a sample. Choose the default country for national input, or International only when a leading + is required.\n\nRun the formatter. It validates the entire input; prose, vanity letters, missing area codes and invalid numbering patterns produce an error rather than guessed digits.\n\nReview the country, calling code, significant digits, extension and validation flags in Report. Choose another Output to copy just the format you need.\n\nCopy or save the result. Keep extensions separate from E.164 and verify consent, ownership or reachability through your own workflow; this tool does not contact the number.',
  notes: [
    'Validation is offline against bundled numbering-plan metadata, which can become outdated. It does not query a carrier, send SMS or make a call.',
    'Possible checks length; valid checks length and digit patterns. Both must pass here before a formatted result is returned.',
    'A calling code is not always one country. +1 is shared; country may be null for non-geographic or ambiguous numbers, and type is only a metadata classification.',
    'Leading + supplies the calling code. Dialing prefixes such as 00 or 011 depend on the selected default country, so prefer + for portable input.',
    'Extensions accept ext. 123, x123, #123 or ;ext=123, with 1–10 ASCII digits. E.164 never includes them; tel: URI does.',
    'Input accepts ASCII digits, spaces, dots, hyphens and balanced nonnested parentheses. Vanity numbers, prose, multiple numbers and URI parameters other than ;ext= are not supported.',
    'Emergency/short codes and incomplete local numbers are not supported. A default country is context, not a request to restrict international input to that country.',
    'The raw input limit is 128 characters. Legacy numeric countryCode field values remain accepted, but new samples specify two-letter country codes.',
  ],
};

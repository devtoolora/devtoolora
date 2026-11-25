import type { ToolContent } from '@devtoolora/core';

export const content: ToolContent = {
  documentation: [
    {
      content:
        'Payment card numbers carry a brand prefix (the issuer identification range), a brand-specific length and a final check digit computed with the Luhn algorithm. The check digit catches most single-digit typos and swapped neighbors.\n\nThis tool detects the brand from the prefix, checks the length allowed for that brand and verifies the Luhn checksum. It can also generate Luhn-valid test numbers for common brands.\n\nEverything runs locally in your browser. A valid result only means the number is well-formed, never that a card exists, is active or has funds.',
      title: 'What is Credit Card Validator & Test Numbers?',
    },
    {
      content: [
        'Check that a pasted test card number was copied correctly before using it in a sandbox or fixture.',
        'Generate placeholder numbers for forms, unit tests and demo data without touching a real card.',
        'Debug why a checkout form rejects a number: brand prefix, length or checksum.',
      ],
      title: 'When to use Credit Card Validator & Test Numbers',
    },
  ],
  examples: [
    '4242 4242 4242 4242 → Visa, 16 digits, Luhn ok, valid.',
    '378282246310005 → American Express, shown as 3782 822463 10005.',
    '4242424242424241 → Visa with a failing Luhn check, invalid.',
    '42424242424242 → a 14-digit number starting with 4 fails the Visa length rule.',
    '1234567812345670 → no known brand prefix, so the brand is Unknown.',
    'Generate with Maestro and count 3 → three 16-digit numbers starting with 5018.',
  ],
  faq: [
    {
      answer:
        'No. The Luhn check and prefix rules only prove the number is well-formed. No issuer is contacted, so the card may not exist, may be expired or may have no funds.',
      question: 'Does a valid result mean the card is real?',
    },
    {
      answer:
        'Yes, spaces and dashes are removed before checking. Any other character, including letters, dots and non-ASCII digits, makes the row Unknown and invalid.',
      question: 'Can I paste numbers with spaces or dashes?',
    },
    {
      answer:
        'Numbers are random with a correct Luhn digit and a brand prefix. They are for test data only and are not tied to any account, but a payment sandbox may still require its own documented test cards.',
      question: 'Are the generated numbers usable for payments?',
    },
    {
      answer:
        'The input is processed in memory in your browser and is never stored or sent anywhere. Still, avoid pasting real card numbers into any tool you do not need to.',
      question: 'Is the pasted number stored anywhere?',
    },
    {
      answer:
        'Brand ranges overlap and change over time. This tool checks the most specific ranges first, so a number in the UnionPay 62 range is Discover when it falls inside 622126 to 622925.',
      question: 'Why was my number detected as a different brand?',
    },
  ],
  help: 'Choose Validate, paste one card number per line and run. Spaces and dashes are ignored; blank lines are skipped.\n\nThe table shows the formatted number, the detected brand, whether the length fits that brand and whether the Luhn checksum passes. Result is valid only when all three succeed.\n\nChoose Generate, pick a brand and a count from 1 to 100 to get Luhn-valid test numbers, one per line.\n\nCopy the result or save card-check.txt or test-cards.txt. These numbers are for test data only; never use real card numbers here.',
  notes: [
    'Input is limited to 1,000 non-blank lines of at most 32 characters each, and 40,000 characters overall.',
    'Numbers shorter than 12 or longer than 19 digits are reported as Unknown and never throw.',
    'Generate returns between 1 and 100 numbers per run; Luhn digits are computed, not looked up.',
    'Supported brands are Visa, Mastercard, American Express, Discover, Diners Club, JCB, UnionPay and Maestro.',
    'Generated numbers are for test data only. They are not linked to any account and will not pass a real authorization.',
    'The input is processed locally and is never stored; results are not cached between runs.',
    'Brand detection uses the first matching issuer range in a fixed order; new or private ranges may show as Unknown.',
    'CVV, expiry date, issuer lookup and any payment authorization are out of scope.',
  ],
};

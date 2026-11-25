import type { ToolContent } from '@devtoolora/core';

export const content: ToolContent = {
  documentation: [
    {
      content:
        'An International Bank Account Number identifies an account using a two-letter country prefix, two check digits and a country-specific Basic Bank Account Number (BBAN). Its length and the allowed letters or digits vary by country.\n\nThe check digits use MOD 97-10. A passing checksum alone is not enough: this validator also checks the registered prefix, exact length and national BBAN character structure. Leading zeroes remain significant.\n\nThe country formats are a bundled snapshot of SWIFT IBAN Registry release 103, September 2026. A valid result confirms these format checks only, not account existence, ownership, bank status or payment safety.',
      title: 'What is an IBAN?',
    },
    {
      content: [
        'Review a copied account identifier for transcription mistakes.',
        'Compare electronic and grouped print formats without changing significant digits.',
        'Inspect which syntax, country, length, structure or checksum check failed while developing import validation.',
      ],
      title: 'When to validate an IBAN',
    },
  ],
  examples: [
    'GB82 WEST 1234 5698 7654 32 → GB82WEST12345698765432; 22 characters.',
    'CZ65 0800 0000 1920 0014 5399 → a 24-character Czech registry example.',
    'FR14 2004 1010 0505 0001 3M02 606 → letters in this BBAN are permitted.',
    'BR66 9999 9A03 0000 1000 9795 493C 1 → the revised September 2026 Brazilian structure permits an alphanumeric bank identifier.',
    'Changing GB82 to GB83 fails the checksum; the validator does not fix it automatically.',
    'Adding a digit to a GB IBAN fails the exact 22-character country length, even if another input could have a passing checksum.',
  ],
  faq: [
    {
      answer:
        'No. Valid means the country prefix, length, BBAN character pattern and MOD 97 check digits are correct. No bank is contacted, so the tool cannot confirm that the account is open or who owns it.',
      question: 'Does a valid IBAN mean the account exists?',
    },
    {
      answer:
        'The first four characters move to the end, letters become numbers (A = 10 through Z = 35), and the resulting number is divided by 97. A correct IBAN leaves remainder 1, which the report shows as remainder.',
      question: 'How does the IBAN checksum work?',
    },
    {
      answer:
        'Yes. Spaces, tabs and line breaks are removed and letters are uppercased before checking. Hyphens, dots and other punctuation are syntax errors, so remove them first.',
      question: 'Can I paste an IBAN with spaces or lowercase letters?',
    },
    {
      answer:
        'Those countries do not issue IBANs, so their prefixes are not among the 89 in the bundled SWIFT registry snapshot. The report marks the country check as failed with UNSUPPORTED_COUNTRY.',
      question: 'Why is a US or Canadian account number rejected?',
    },
    {
      answer:
        'No. The failed MOD 97 check is reported and the input is left unchanged; generating new check digits would make a mistyped account number look valid.',
      question: 'Can the validator fix wrong check digits?',
    },
  ],
  help: 'Paste one IBAN or apply a complete sample. Lowercase letters become uppercase and whitespace is removed; punctuation and significant zeroes are never silently stripped.\n\nRun Report and inspect valid, checks and issues. Each check is pass, fail or not-checked; skipped checks do not imply success.\n\nCompare the received length with expectedLength and read the country structure. In structure notation, n means digit, a means letter, c means alphanumeric and ! marks a fixed count.\n\nCopy or save iban-report.json for diagnostics. For a passing IBAN, choose Electronic or Print to copy just the identifier; verify account details independently before using them.',
  notes: [
    'The bundled snapshot contains the 89 IBAN prefixes in SWIFT Registry 103 (September 2026). It does not fetch live registry updates.',
    'Some territories use another registered prefix. Do not replace the actual IBAN prefix with an ISO territory code guessed from an address.',
    'Valid requires correct ASCII syntax, check digits 02–98, supported country, exact national length, BBAN character structure and MOD 97-10 remainder 1.',
    'Domestic account/bank/branch checksum algorithms, bank directories, BIC derivation, SEPA eligibility and active account status are not checked.',
    'Lowercase ASCII letters and whitespace, including tabs and line breaks, are normalized. Hyphens, labels, multiple IBANs, non-ASCII lookalikes and other punctuation are rejected as syntax failures.',
    'Invalid identifiers still receive a diagnostic JSON report. Electronic and Print modes reject invalid identifiers instead of returning a copy-ready value.',
    'The raw input limit is 128 characters; an IBAN has at most 34 normalized characters. Large numeric representations are processed incrementally, without floating-point rounding.',
    'Examples are documentation fixtures, not payment instructions. No transfer, bank lookup, external request or automatic checksum repair is performed.',
  ],
};

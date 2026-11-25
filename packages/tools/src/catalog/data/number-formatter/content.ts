import type { ToolContent } from '@devtoolora/core';

export const content: ToolContent = {
  documentation: [
    {
      content:
        'Number formatting changes how a value is displayed: grouping, decimal separators, currency symbols and percent signs follow a chosen locale. Formatting is not parsing a localized price or converting between currencies.\n\nInput uses plain decimal syntax with a dot and optional sign or e exponent. Plain integers use bigint internally; decimal strings go directly to modern Intl.NumberFormat without first losing digits in a JavaScript Number.\n\nFraction digits control display rounding. Maximum removes unnecessary trailing zeroes; Fixed pads to the requested count. Percent input is a ratio: 0.856 means 85.6%, not 0.856%.',
      title: 'What is number formatting?',
    },
    {
      content: [
        'Preview how a value appears in a localized UI or report.',
        'Prepare consistent decimal, currency and percentage labels without changing the underlying source.',
        'Inspect exact separator characters, resolved locale and rounding settings before copying text into another system.',
      ],
      title: 'When to format numbers',
    },
  ],
  examples: [
    'en-US decimal 1234567.89 → 1,234,567.89.',
    'de-DE currency EUR 1234567.89 → 1.234.567,89 followed by a nonbreaking space and €.',
    'cs-CZ currency CZK 1234567.89 uses decimal comma and nonbreaking grouping spaces.',
    'Percent 0.856 with one fraction digit → 85.6% in en-US.',
    '9007199254740993.125 with three fraction digits retains every digit rather than becoming 9007199254740994.',
    'Value 1.5 with Fixed 3 → 1.500; Maximum 3 → 1.5.',
  ],
  faq: [
    {
      answer:
        'The input stays an exact decimal string and goes straight to Intl.NumberFormat, so 1.005 is a true halfway value and rounds away from zero to 1.01. toFixed works on the nearest binary double, which is slightly below 1.005.',
      question: 'Why does 1.005 round to 1.01 here but to 1.00 with toFixed?',
    },
    {
      answer:
        'Choose Percent and enter the ratio: 0.25 becomes 25%, and 0.856 with one fraction digit becomes 85.6%. Entering 25 displays 2,500%.',
      question: 'How do I format a value as a percentage?',
    },
    {
      answer:
        'Fraction digits applies in every mode and overrides the currency’s usual minor units. Set it to 0 for yen, so 1234.5 in ja-JP shows ￥1,235.',
      question: 'Why does JPY show two decimal places?',
    },
    {
      answer:
        'No. The currency code only changes the symbol and its placement; 1234.5 shows the same digits in EUR and USD. No exchange rate is applied.',
      question: 'Does changing the currency convert the amount?',
    },
    {
      answer:
        'Many locales group digits with a nonbreaking or narrow nonbreaking space; fr-FR writes 1234.5 as 1 234,5 with U+202F. Choose Report to see the group separator and every other part listed on its own.',
      question: 'Why are the spaces in my formatted number not normal spaces?',
    },
    {
      answer:
        'No. Input must be an ungrouped number with a dot decimal, such as 1234.56. Grouping separators, decimal commas and currency symbols are rejected so a value is never misread.',
      question: 'Can I paste 1,234.56 or 1.234,56 as input?',
    },
  ],
  help: 'Paste one ungrouped decimal value or apply a complete sample. Use a dot for input regardless of the output locale; remove currency symbols and percent signs yourself.\n\nChoose Decimal, Currency or Percent, then set locale, fraction digits, Maximum/Fixed precision and grouping. In Percent mode enter the ratio, such as 0.25 for 25%.\n\nRun and review the formatted value. Report additionally shows the exact input string, resolved locale, applied fraction limits and parts with their actual separator characters.\n\nCopy or save formatted-number.txt or number-format-report.json. Keep the original numeric source for calculations; the display may be rounded and contains locale-specific characters.',
  notes: [
    'Input permits ASCII decimal digits, optional +/− sign, decimal dot and e/E exponent. Grouping commas/spaces, locale decimal commas, symbols, NaN, Infinity, hex and binary notation are rejected.',
    'The raw input limit is 1024 characters. Plain integers remain exact within that limit. Decimal/exponent input must stay within Intl’s finite magnitude range; overflow and underflow are rejected.',
    'Exact decimal-string support is checked at runtime. Older engines fail explicitly instead of silently falling back to a precision-losing Number conversion.',
    'Fraction digits are an integer from 0–20 and apply to Decimal, Currency and Percent. Fixed pads trailing zeroes; Maximum omits them.',
    'Default Intl display rounding is used, including ties away from zero. Formatting is not financial arithmetic, cash rounding, an exchange rate or a payment calculation.',
    'Locale data and symbols come from the runtime’s ICU/CLDR version and can vary between platforms. Unsupported languages or malformed tags are rejected; regional fallback is visible in Report.',
    'Currency mode accepts codes reported by Intl.supportedValuesOf. Currency is ignored in Decimal and Percent modes; choosing another code relabels the same amount, it never exchanges it.',
    'Spaces may be nonbreaking or narrow nonbreaking. Copy and download preserve the exact characters; Report parts helps distinguish them from ordinary spaces.',
  ],
};

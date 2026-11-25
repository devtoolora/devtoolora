import type { ToolContent } from '@devtoolora/core';

export const content: ToolContent = {
  documentation: [
    {
      content:
        'A numeral base tells you how many digit values each position can hold. Decimal uses 0–9; binary uses 0–1; hexadecimal uses 0–9 and a–f.\n\nChanging the base changes the spelling, not the number: decimal 255, hexadecimal ff and binary 11111111 all have the same value.\n\nThis converter reads every digit and uses exact integer arithmetic. It does not round large values or accept a valid prefix of an otherwise invalid number.',
      title: 'What is a numeral base?',
    },
    {
      content: [
        'Inspect binary flags, hexadecimal integer values, octal permission numbers or decimal IDs.',
        'Convert long whole-number identifiers without losing digits through floating-point arithmetic.',
        'Compare representations while learning positional notation. For encoded text or file bytes, use the binary/hex text tools instead.',
      ],
      title: 'When to use Base Converter',
    },
  ],
  examples: [
    'ff, base 16 → base 10: 255.',
    '0b11111111, base 2 → base 16: ff.',
    '0755, base 8 → base 10: 493. Without base 8, leading zeroes do not imply octal.',
    '18446744073709551615, base 10 → base 16: ffffffffffffffff, with every digit retained.',
    '-42, base 10 → base 2: -101010 (signed magnitude, not a fixed-width two’s-complement bit pattern).',
    'zz, base 36 → base 10: 1295. 102 in base 2 fails because 2 is not a binary digit.',
  ],
  faq: [
    {
      answer:
        'The converter keeps the sign and converts the magnitude, so -1 in base 10 becomes -1 in base 16. It has no bit width, so it never produces a two’s-complement pattern such as ffffffff.',
      question: 'Why does -1 not convert to ffffffff?',
    },
    {
      answer:
        'No. Only whole numbers are accepted; 3.5 fails with an invalid-digit error at the dot. Fractions, scientific notation, underscores and grouping commas are rejected rather than rounded.',
      question: 'Can I convert a number with a decimal point?',
    },
    {
      answer:
        'Yes. Digits are read into a BigInt, so values up to 10,000 digits convert without floating-point rounding. In the JSON report, decimal values beyond ±9007199254740991 are written as strings to keep every digit.',
      question: 'Are very large numbers converted exactly?',
    },
    {
      answer:
        'Yes, if the prefix matches From base: 0x needs base 16, 0o needs base 8 and 0b needs base 2. 0x1F with From base 10 is an error instead of being silently reinterpreted. So is 0b11 with From base 16, which could be either a binary literal or hex digits; 0b or 0b1f in base 16 cannot be binary, so they are read as hex digits.',
      question: 'Can I paste values with a 0x or 0b prefix?',
    },
    {
      answer:
        'Any integer base from 2 through 36, using 0–9 and then a–z for digits 10–35. Input letters are case-insensitive and output is lowercase, so FF in base 16 gives 255 and 255 back to base 16 gives ff.',
      question: 'Which bases and digits are supported?',
    },
  ],
  help: 'Enter the integer in Value and choose the input’s actual base. Applying an example also sets both bases and the output mode.\n\nChoose the target base from 2 through 36 and run the conversion. Invalid digits, fractional numbers and mismatched prefixes produce an error rather than a partial result.\n\nUse Converted value for a directly copyable integer. JSON report also includes the original trimmed input, both bases and the exact decimal equivalent.\n\nCopy or save the output. To check a round-trip, paste the converted value into Value and exchange the source and target bases.',
  notes: [
    'Bases must be integers from 2 through 36. Invalid bases are rejected, never rounded or clamped.',
    'Only ASCII digits 0–9 and letters a–z are supported. Input letters are case-insensitive; output is lowercase without a prefix.',
    '0b, 0o and 0x are input prefixes for source bases 2, 8 and 16 respectively. In another base they are an error, unless every character is a digit of that base and the rest cannot be a number in the prefix base. Prefixes may follow + or − (use ASCII -).',
    'Outer whitespace is ignored. Internal spaces, underscores, grouping commas, decimal points and scientific notation in decimal input are not accepted.',
    'Leading zeroes and a leading + are removed in the converted value. Negative zero becomes 0; padding and bit width are not retained.',
    'Negative values keep a minus sign. This is numeric conversion, not UTF-8 encoding, endianness conversion or fixed-width two’s-complement interpretation.',
    'Up to 10,000 input digits plus an optional sign and prefix are accepted; the raw input also has this size bound. Output can have more digits in a smaller base and is never truncated.',
    'JSON report represents decimal values inside ±9007199254740991 as numbers and larger values as exact strings. Its output field is always a string, so another application can preserve all digits.',
  ],
};

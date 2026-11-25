import type { ToolContent } from '@devtoolora/core';

export const content: ToolContent = {
  documentation: [
    {
      content:
        'IEEE 754 stores a number as a sign bit, a biased exponent and a fraction. Half precision (binary16) has 5 exponent and 10 fraction bits, single (binary32) has 8 and 23, and double (binary64) has 11 and 52.\n\nMost decimals, such as 0.1, have no exact binary form, so the format keeps the nearest representable value. This inspector shows that stored value as a full decimal expansion, the exact rounding error and the neighboring values one bit pattern away.',
      title: 'What is an IEEE 754 float?',
    },
    {
      content: [
        'Explain why 0.1 + 0.2 is not 0.3, or why a float32 value prints differently in another language.',
        'Decode a hex bit pattern from a memory dump, network packet or shader into its value and class.',
        'Check the range and precision of half floats used by GPUs and machine-learning models before storing data in them.',
      ],
      title: 'When to use IEEE 754 Float Inspector',
    },
  ],
  examples: [
    '0.1, single: 0x3dcccccd, stored 0.100000001490116119384765625, rounding error 0.000000001490116119384765625.',
    '0.1, double: 0x3fb999999999999a, shortest 0.1.',
    '65520, half: rounds up to 0x7c00 (Infinity); 65519 stays 0x7bff (65504).',
    '0x00000001, single: subnormal, shortest 1e-45.',
    '-0, single: 0x80000000, class zero with the sign bit set.',
    '0x7d00, half: signaling NaN; 0x7e00 is a quiet NaN.',
  ],
  faq: [
    {
      answer:
        'Because 0.1 has no finite binary expansion. Single precision keeps the nearest value, 0.100000001490116119384765625, and the Rounding error row shows the exact difference.',
      question: 'Why is 0.1 not stored exactly?',
    },
    {
      answer:
        'Shortest is the decimal with the fewest significant digits that rounds back to the same bits, as JavaScript would print it. Stored value is the exact value of those bits, written out in full.',
      question: 'What is the difference between Stored value and Shortest?',
    },
    {
      answer:
        'No. The decimal is rounded directly from its exact value to the chosen format with round half to even, so half and single precision are never double-rounded through a double first.',
      question: 'Is the input rounded through a double first?',
    },
    {
      answer:
        'A NaN with the top fraction bit set is quiet and propagates through arithmetic; with that bit clear and any other fraction bit set it is signaling. Typing nan produces the canonical quiet NaN.',
      question: 'How are quiet and signaling NaNs told apart?',
    },
  ],
  help: 'Type or paste a decimal number such as 0.1, -2.5 or 1e-3, the words inf, -inf or nan, or a hex bit pattern starting with 0x.\n\nChoose Half (16-bit), Single (32-bit) or Double (64-bit). A hex pattern must have exactly 4, 8 or 16 digits to match the chosen format.\n\nThe output lists the hex and binary encoding, the sign, biased and unbiased exponent, the fraction, the class and the exact stored value.\n\nShortest, Rounding error and Next up / Next down help you see how far apart neighboring values are. Copy or save the report as text.',
  notes: [
    'Input is limited to 1,000 characters, and a decimal exponent must be within -10,000 to 10,000.',
    'Decimals round to the nearest value with ties to even; values beyond the largest finite number become Infinity and tiny values become a subnormal or a signed zero.',
    'Rounding error is stored minus input, printed exactly, or exact when they match. It is left out for hex input and when the result is Infinity or NaN.',
    'For a subnormal or zero, the unbiased exponent shows the minimum exponent the value actually uses, not the biased field minus the bias.',
    'Next up and Next down step one bit pattern, crossing zero into the subnormals and stopping at Infinity. NaN has no neighbors and shows NaN.',
    'Words inf, infinity and nan are case-insensitive and may carry a sign; a typed NaN is the quiet NaN with only the top fraction bit set.',
  ],
};

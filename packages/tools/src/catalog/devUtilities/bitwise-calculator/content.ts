import type { ToolContent } from '@devtoolora/core';

export const content: ToolContent = {
  documentation: [
    {
      content: [
        'Bitwise operations work on the individual bits of integers. AND keeps a bit only when both inputs have it, OR keeps it when either has it, and XOR keeps it when exactly one has it. NAND, NOR and XNOR are those results inverted, and NOT flips every bit of A.',
        'Shifts move bits left or right and fill the gap with zeros. A logical shift right always fills with zeros, while an arithmetic shift right copies the sign bit so negative numbers stay negative. A rotate moves bits out of one end and back in at the other, so no bit is lost.',
        'Every value has a fixed width of 8, 16, 32 or 64 bits. A negative decimal such as -1 is stored in two’s complement, so at 8 bits it is 0xFF. The same bits read as 255 unsigned or -1 signed, and the result shows both.',
      ],
      title: 'What are bitwise operations?',
    },
    {
      content: [
        'Build or decode flag masks, permission bits and hardware register values.',
        'Check what a shift or rotate does at a specific width before writing it in code.',
        'Compare the unsigned and signed reading of the same bit pattern.',
        'Work with 64-bit values such as hashes and IDs without losing precision to floating-point numbers.',
      ],
      title: 'When to use Bitwise Calculator',
    },
  ],
  examples: [
    '12 AND 0b1010 at 8 bits → 0x08: only bit 3 is set in both values.',
    '-1 at 8 bits → 0xFF: a negative decimal is read as two’s complement.',
    '0x81 shifted left by 1 at 8 bits → 0x02: the top bit is shifted out and lost.',
    '0x81 rotated left by 1 at 8 bits → 0x03: the top bit wraps around to bit 0.',
    '0x80 with an arithmetic shift right by 7 at 8 bits → 0xFF: the sign bit is copied in.',
    '200 + 100 at 8 bits → 0x2C with carry yes: the exact sum 300 does not fit and wraps modulo 256.',
    '0xFFFFFFFFFFFFFFFF XOR 1 at 64 bits → 0xFFFFFFFFFFFFFFFE, which is -2 signed.',
  ],
  faq: [
    {
      answer:
        'Both fill the freed bits at the top, but a logical shift right (>>>) fills with zeros and an arithmetic shift right (>>) copies the sign bit. They agree for values with the top bit clear and differ for negative numbers.',
      question: 'What is the difference between >> and >>>?',
    },
    {
      answer:
        'A shift discards the bits that move past either end and fills with zeros, while a rotate feeds those bits back in at the other end. Rotating by the full width returns the original value.',
      question: 'How is a rotate different from a shift?',
    },
    {
      answer:
        'A leading minus sign on a decimal number is stored in two’s complement at the chosen width, so -1 at 8 bits is 0xFF. A value must fit the width as signed or unsigned: at 8 bits that means -128 to 255.',
      question: 'How are negative numbers handled?',
    },
    {
      answer:
        'Yes. All arithmetic uses BigInt, so 64-bit values beyond 2^53 stay exact. Plain JavaScript numbers lose precision above 9,007,199,254,740,991, which is why the calculator never converts through them.',
      question: 'Are 64-bit values exact?',
    },
    {
      answer:
        'Use decimal, 0x for hex, 0b for binary or 0o for octal. Underscores may separate digits, so 0b1010_1010 and 1_000 work. Fractions and exponents such as 1.5 or 1e3 are rejected.',
      question: 'Which number formats can I enter?',
    },
    {
      answer:
        'Arithmetic wraps to the chosen width, like a CPU register. 200 + 100 at 8 bits gives 0x2C because the sum is taken modulo 256. Carry reports that the unsigned result did not fit (or, for subtract, that A was below B), and overflow reports that the signed result left the signed range.',
      question: 'What happens when arithmetic overflows the width?',
    },
  ],
  help: 'Enter A, choose an operation and a width. Numbers can be decimal, 0x hex, 0b binary or 0o octal, with underscores allowed as separators. A negative decimal is read as two’s complement at the chosen width.\n\nFor arithmetic, AND, OR, XOR, NAND, NOR and XNOR, B is the second operand. For shifts and rotates, B is the number of positions, from 0 to the width. NOT has no B.\n\nThe result lists A, B and the result in hex, unsigned, signed and binary with groups of four bits, then the set bits with their values. Arithmetic adds a Flags line with carry and overflow; signed divide reports overflow only for the most negative value divided by -1. A value must fit the width as signed or unsigned, so 256 is rejected at 8 bits.\n\nCopy the text or save it as bitwise.txt. Everything is calculated on your device with BigInt, so 64-bit values stay exact.',
  notes: [
    'Processing is local; nothing is uploaded.',
    'Limits: widths 8, 16, 32 and 64 bits; shift and rotate amounts 0 to the width; inputs up to 256 characters.',
    'A value must fit the width as signed or unsigned: -128 to 255 at 8 bits, up to 2^64 - 1 at 64 bits.',
    'The result is always masked to the width, so a left shift drops the bits that leave it.',
    'Arithmetic wraps to the width; dividing by zero is rejected. Unsigned divide and both remainders report no flags, and signed division truncates toward zero.',
    'A shift or rotate by the full width is allowed: a shift gives 0 (or the sign fill for an arithmetic shift) and a rotate returns A.',
  ],
};

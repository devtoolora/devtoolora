import type { ToolContent } from '@devtoolora/core';

export const content: ToolContent = {
  documentation: [
    {
      content: [
        'An arithmetic expression combines numbers with operators. Parentheses group operations; multiplication, division and remainder run before addition and subtraction.',
        'This tool parses arithmetic locally, without eval or running JavaScript. It accepts decimal numbers, scientific notation, unary signs, parentheses and + - * / %.',
        'The % operator means remainder, not percentage. Use Percentage Calculator for questions such as 25% of 200.',
      ],
      title: 'What is an arithmetic expression?',
    },
    {
      content: [
        'Check short arithmetic expressions while coding.',
        'Compare operator precedence with explicitly grouped calculations.',
        'Evaluate decimal or scientific-notation examples without a spreadsheet.',
      ],
      title: 'When to use Math Evaluator',
    },
  ],
  examples: [
    '(12 + 8) * 3 / 4 → 15.',
    '2 + 3 * 4 → 14; (2 + 3) * 4 → 20.',
    '.5 + 1.5 → 2.',
    '1e3 / 4 → 250.',
    '-7 % 3 → -1 (remainder retains the dividend sign).',
    '0.1 + 0.2 → 0.30000000000000004 with binary floating-point arithmetic.',
  ],
  faq: [
    {
      answer:
        'No. % is the remainder operator, so 25 % 200 returns 25 and -7 % 3 returns -1. Use Percentage Calculator for questions such as 25% of 200.',
      question: 'Does % calculate a percentage?',
    },
    {
      answer:
        'Numbers use binary double-precision floating point, which cannot store 0.1 or 0.2 exactly. The unrounded JavaScript result is shown instead of hiding the error, so round it yourself when you need fixed decimals.',
      question: 'Why does 0.1 + 0.2 show 0.30000000000000004?',
    },
    {
      answer:
        'They are not supported: there is no ^ or ** operator and no functions such as sqrt, so 2^3 and sqrt(4) fail with an unexpected-token error. Multiply explicitly or use scientific notation such as 1e3.',
      question: 'How do I write exponents or square roots?',
    },
    {
      answer:
        'Yes. Input is read by a small arithmetic parser, not passed to eval or the JavaScript engine, so text such as process.exit() is rejected as an unexpected token instead of running.',
      question: 'Is it safe to paste an untrusted expression?',
    },
    {
      answer:
        'Implicit multiplication is not supported. Write 2 * (3); every operation needs an explicit +, -, *, / or % operator.',
      question: 'Why is 2(3) rejected?',
    },
    {
      answer:
        'No. Integers above 9007199254740991 can lose precision, so 9007199254740993 + 0 returns 9007199254740992. Use Base Converter when you need exact whole-number digits.',
      question: 'Are large integers calculated exactly?',
    },
  ],
  help: 'Enter an expression or apply a sample.\n\nUse explicit * for multiplication and parentheses for grouping.\n\nRun the calculation. Invalid syntax, division by zero and non-finite results produce an error.\n\nCopy or download the exact displayed result.',
  notes: [
    'No variables, functions, assignments, implicit multiplication, power operator or JavaScript execution.',
    'Use an ASCII minus sign and decimal dot. Commas and grouping separators are not accepted.',
    'All values use JavaScript floating-point arithmetic, not exact decimal money arithmetic.',
    'Maximum input is 10,000 characters and 128 nested parentheses/unary signs.',
    'A finite rounded result is not evidence of exact arithmetic; very large or very small values can lose precision.',
    'Percent calculations use a separate tool; 25 % 200 evaluates to the remainder 25.',
  ],
};

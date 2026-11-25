import type { ToolContent } from '@devtoolora/core';

export const content: ToolContent = {
  documentation: [
    {
      content: [
        'Percent means per hundred. The question determines which number is the base: 25% of 200 is 50, while 25 out of 200 is 12.5%.',
        'Percent change compares a new value with a positive original value: (new − old) / old × 100. A zero baseline is undefined and a negative baseline is intentionally rejected.',
        'Add/subtract uses the same original base for both results. Reversing a percentage increase requires division, not subtracting the same percentage.',
      ],
      title: 'What is a percentage?',
    },
    {
      content: [
        'Calculate a share, discount or markup using an explicit base.',
        'Compare a part with a nonzero total.',
        'Inspect the relative change between two values and read the formula alongside the answer.',
      ],
      title: 'When to use Percentage Calculator',
    },
  ],
  examples: [
    'Percent 25, value 200 → 50.',
    'Part 25, total 200 → 12.5%.',
    'Old value 200, new value 250 → 25% increase; old 250, new 200 → 20% decrease.',
    'Value 200, percent 15 → increased 230 and decreased 170.',
    'Old value 20, new value 25 → 25%; for rates, 20% to 25% is +5 percentage points but a 25% relative increase.',
    'Value 200, percent 0 → increased 200 and decreased 200.',
  ],
  faq: [
    {
      answer:
        'Choose Percent change and enter Old value and New value. The result is (new − old) / old × 100, so 200 to 250 is 25% and 250 to 200 is −20%; the report also gives direction and changeAmount.',
      question: 'How do I calculate the percent change between two numbers?',
    },
    {
      answer:
        'Each percentage uses its own base. Decreasing 250 by 20% gives 200, but increasing 200 by 20% gives 240, not 250; getting from 200 back to 250 takes a 25% increase.',
      question: 'Why does a 20% increase not undo a 20% decrease?',
    },
    {
      answer:
        'An old value of 0 would mean dividing by zero, so it is an error. Negative old values are rejected too, because a percentage change from a negative starting point has no single accepted meaning.',
      question: 'Why is an old value of zero or below rejected?',
    },
    {
      answer:
        'No. Enter 25 in Percent; fields accept plain decimal numbers only, so 25%, 1,5 and hexadecimal values are rejected. Use a dot as the decimal separator.',
      question: 'Can I type the percent sign, as in 25%?',
    },
    {
      answer:
        'No. Inputs are calculated as exact decimals, so 7% of 100 is exactly 7. A result with no finite decimal form keeps full double precision: part 1 of total 3 returns 33.333333333333336%, so round the value yourself for presentation.',
      question: 'Are percentage results rounded?',
    },
  ],
  help: 'Choose the question first. Only relevant fields are shown.\n\nEnter numbers with a decimal dot; zero is valid except as a division baseline.\n\nRead the result and its formula. Add/subtract returns two independently adjusted amounts.\n\nCopy or save the JSON report. Changing an input recalculates the answer.',
  notes: [
    'Blank fields are missing input, never an implicit zero.',
    'No division by zero: Total cannot be zero; Old value must be positive.',
    'Signed amounts and percentages are supported for percent-of and add/subtract; negative percentages reverse the adjustment direction.',
    'Results are not rounded for display; a repeating result is limited to double precision. No tax, currency or financial policy is inferred.',
    'Percentages and percentage points are different concepts; no percentage-point mode is implied.',
    'Numbers must be finite decimal values; hex, Infinity and locale commas are rejected.',
  ],
};

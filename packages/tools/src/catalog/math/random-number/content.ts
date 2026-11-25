import type { ToolContent } from '@devtoolora/core';

export const content: ToolContent = {
  documentation: [
    {
      content:
        'A random number generator draws values that cannot be predicted from earlier ones. This tool takes its randomness from the operating system through crypto.getRandomValues, the same source browsers use for keys and tokens, and there are no seeds to set or leak.\n\nTo keep every value equally likely, a draw is turned into a number in the range by rejection sampling: random bits are masked to the size of the range and any value outside it is thrown away and drawn again, instead of being wrapped with a modulo that would favor small values.\n\nIntegers mode picks whole numbers between Min and Max. Decimals mode picks a value in steps of 10 to the power of minus the decimal places, so every printed value is equally likely. Dice mode rolls NdM notation: N dice with M sides, plus or minus a fixed modifier.',
      title: 'How the numbers are drawn',
    },
    {
      content: [
        'Pick a lottery draw, a raffle winner or a sample of row numbers without repeats.',
        'Generate test data such as ids, prices or probabilities in a given range.',
        'Roll dice for a tabletop game, with a modifier and several rolls at once.',
        'Get an unbiased random choice when a coin flip or a shell one-liner is not available.',
      ],
      title: 'When to use Random Number Generator',
    },
  ],
  examples: [
    'Integers from 1 to 100, count 1: a single number such as 42.',
    'Integers from 1 to 49, count 6, unique and sorted: a lottery draw such as 3, 11, 18, 27, 40, 46.',
    'Integers from -1000 to 1000, count 5: five values that may repeat.',
    'Decimals from 0 to 1, 4 places, count 3: values such as 0.3817, 0.9042, 0.0005.',
    '2d6 rolls two six-sided dice and prints a line such as 2d6: [4, 1] = 5.',
    '1d20+5 with 3 rolls prints three lines such as 1d20+5: [14] + 5 = 19.',
  ],
  faq: [
    {
      answer:
        'The values come from crypto.getRandomValues, a cryptographically secure source, and are reduced to the range with rejection sampling, so none of them is more likely than another. They are fine for games and sampling; for secrets use Random Token instead.',
      question: 'Is the randomness good enough?',
    },
    {
      answer:
        'No. The generator has no seed, so a result cannot be reproduced. Copy or save the output if you need to keep it.',
      question: 'Can I get the same numbers again with a seed?',
    },
    {
      answer:
        'With Unique values on, each integer appears at most once, so the count cannot exceed the number of integers between Min and Max. Asking for more gives an error naming how many distinct values exist.',
      question: 'What does Unique values do?',
    },
    {
      answer:
        'Use NdM, NdM+K or NdM-K: N is the number of dice, M the number of sides and K a fixed modifier added to each roll total. The d is case-insensitive, so 2D6+3 works too. The Dice Roller starts in this mode.',
      question: 'Which dice notation is supported?',
    },
  ],
  help: 'Choose a mode: Integers, Decimals or Dice.\n\nIntegers and Decimals take a Min, a Max and a Count; Integers can also be unique and sorted, and Decimals have a number of decimal places.\n\nDice takes a notation such as 2d6+3 and the number of rolls. Each roll is printed on its own line with the individual dice and the total.\n\nRun the tool again for new numbers; every run draws fresh values. Copy or save the result as text.',
  notes: [
    'Count is 1-10,000 values per run.',
    'Integers must be whole numbers within ±(2^53 - 1), which keeps every value exactly representable.',
    'Decimal places are 0-15, and Min and Max may not have more places than that.',
    'Dice rolls use 1-100 dice with 2-1,000 sides each and 1-1,000 rolls per run.',
    'Values come from crypto.getRandomValues by rejection sampling, so every value in the range is equally likely.',
    'There are no seeds: results cannot be reproduced, and Min must not exceed Max.',
  ],
};

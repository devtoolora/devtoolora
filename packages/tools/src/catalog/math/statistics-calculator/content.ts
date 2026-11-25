import type { ToolContent } from '@devtoolora/core';

export const content: ToolContent = {
  documentation: [
    {
      content:
        'Descriptive statistics summarize a list of numbers with a few figures: the center (mean, median, mode), the spread (range, variance, standard deviation, interquartile range) and the position of values within the ordered list (percentiles).\n\nThe population variance divides by n and describes the whole list; the sample variance divides by n - 1 and estimates the spread of a larger group the list was drawn from.',
      title: 'What are descriptive statistics?',
    },
    {
      content: [
        'Summarize measurements, timings, scores or prices pasted from a spreadsheet or log.',
        'Find the median and percentiles such as P95 or P99 of response times.',
        'Check the spread of a data set before deciding whether an average is representative.',
      ],
      title: 'When to use Statistics Calculator',
    },
  ],
  examples: [
    '2, 4; 4 4\n5 5 7 9 gives mean 5, median 4.5, mode 4 and population std dev 2.',
    '1 2 3 4 with a custom percentile of 10 adds P10 1.3.',
    '1 4 16 has a geometric mean of 4.',
    '1 2 3 has no mode, because no value repeats.',
    '42 is a single number, so the sample variance and sample std dev are left out.',
    '0.1 0.2 gives a sum of 0.3 thanks to compensated summation.',
  ],
  faq: [
    {
      answer:
        'The population figures divide by n and treat the list as the whole group. The sample figures divide by n - 1 and are the usual choice when the list is a sample of something larger. Sample figures need at least two numbers.',
      question: 'What is the difference between population and sample?',
    },
    {
      answer:
        'The mode is every value that appears most often, and only when that count is greater than one. If every value is unique the mode is none, shown as null in JSON.',
      question: 'When is there no mode?',
    },
    {
      answer:
        'Percentiles use linear interpolation between the closest ranks, the same method as Excel PERCENTILE.INC and the NumPy default. The rank is (n - 1) x p / 100.',
      question: 'Which percentile method is used?',
    },
    {
      answer:
        'The geometric mean is the exp of the mean of the natural logarithms, so it is defined only when every number is positive. Otherwise the row is left out and the JSON value is null.',
      question: 'Why is the geometric mean missing?',
    },
  ],
  help: 'Paste numbers separated by commas, semicolons, spaces or line breaks.\n\nThe result lists count, sum, minimum, maximum, range, mean, median, mode, variance, standard deviation, percentiles, the interquartile range and the geometric mean.\n\nEnter a custom percentile from 0 to 100 to add one more row, and switch the output to JSON to get the same figures as an object.\n\nCopy or save the result as text or JSON.',
  notes: [
    'Input is limited to 5,000,000 UTF-16 code units and 100,000 numbers; larger input is an error.',
    'Numbers use a dot as the decimal point, with an optional sign and exponent; anything else is an error naming the token and its position.',
    'Percentiles use linear interpolation between the closest ranks (Excel PERCENTILE.INC, NumPy default).',
    "Sums use compensated summation and variance uses Welford's method, but a sum or variance beyond the double range is an error.",
    'Min, max and mode repeat the input exactly. Every calculated figure is rounded to 15 significant digits, so a sum or median of values longer than that can differ in the last digits.',
    'The custom percentile must be a number from 0 to 100 and adds a P<n> row after P99.',
    'Missing values are left out of the table and shown as null in JSON: sample figures for one number, mode when no value repeats, and the geometric mean when any value is not positive.',
  ],
};

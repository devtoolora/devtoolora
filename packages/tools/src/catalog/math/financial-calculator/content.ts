import type { ToolContent } from '@devtoolora/core';

export const content: ToolContent = {
  documentation: [
    {
      content: [
        'Compound interest applies interest to both the principal and previous interest. This calculator uses one initial deposit and annual compounding: P × (1 + r)^years.',
        'The loan model estimates equal end-of-month principal-and-interest payments at a constant nominal annual rate divided by 12. It assumes full repayment over a whole number of months.',
        'The annual rate is an input assumption, not a forecast or an APR disclosure. Fees, taxes, insurance and additional deposits or repayments are excluded.',
      ],
      title: 'What are compound interest and loan payments?',
    },
    {
      content: [
        'Explore a fixed-rate development example with explicit assumptions.',
        'Compare annual compound growth for one deposit.',
        'Estimate principal-and-interest payments before using a lender-specific calculation or independent financial advice.',
      ],
      title: 'When to use Loan & Compound Calculator',
    },
  ],
  examples: [
    'Compound, 1000 at 10% for 2 years → futureValue 1210, interestEarned 210.',
    'Loan, 1200 at 0% for 1 year → monthlyPayment 100, totalInterest 0.',
    'Loan, 1200 at 12% for 1 year → monthlyPayment 106.62, totalInterest 79.42.',
    'Compound, 1000 at 0% for 10 years → futureValue 1000.',
    'Compound, principal 0 → futureValue 0 and interestEarned 0; 0 is not treated as missing.',
    'Loan years 1.5 → 18 monthly payments; 0.1 years → an error, because it is not a whole number of months.',
  ],
  faq: [
    {
      answer:
        'The standard amortized payment P × r / (1 − (1 + r)^−n), where r is the annual rate divided by 12 and n is years × 12. At 0% the payment is simply P / n.',
      question: 'What formula does the loan payment use?',
    },
    {
      answer:
        'No. The result is principal and interest only. Property tax, insurance, mortgage insurance, fees, extra payments and rate changes are not modeled, so a lender’s quoted payment can differ.',
      question: 'Does the monthly payment include taxes, insurance or fees?',
    },
    {
      answer:
        'Once a year. Future value is P × (1 + rate)^years for a single deposit, with no monthly or daily compounding and no recurring contributions. Fractional years are allowed: 1000 at 5% for 0.5 years gives 1024.7.',
      question: 'How often does compound mode compound interest?',
    },
    {
      answer:
        'The loan term must be a whole number of months and greater than zero. 1.5 years (18 months) works, while 1.01 or 0.1 years is rejected instead of being rounded.',
      question: 'Why is my loan term rejected?',
    },
    {
      answer:
        'Each amount is rounded to two decimals on its own. Total paid and total interest come from the unrounded payment, so they can differ by a few cents from the rounded monthly payment times the number of months.',
      question: 'Why does total paid not equal the monthly payment times the months?',
    },
  ],
  help: 'Choose Compound interest or Loan payment.\n\nEnter principal, annual rate in percent and duration in years. Use the same unspecified currency unit throughout.\n\nRun the calculation and read the visible assumptions and model result.\n\nCopy or download the JSON report; do not treat it as a quote, repayment schedule or guaranteed return.',
  notes: [
    'Principal and annual rate must be nonnegative; duration must be positive. Negative-rate models are unsupported.',
    'Compound uses annual compounding only, not daily/monthly compounding or recurring contributions.',
    'Loan uses monthly payments and a nominal annual rate, not effective annual yield, variable rates or lender day-count rules.',
    'Zero interest is handled without division by zero. Very small loan rates use a numerically stable denominator.',
    'Amounts are rounded to two decimals independently; totals use unrounded payments, not the rounded monthly payment multiplied back.',
    'No currency is selected or converted. Two-decimal display is a model convention, not support for every currency minor-unit rule.',
    'Floating-point estimates exclude taxes, insurance, fees, inflation and payment-by-payment rounding; this is not financial advice.',
    'Source references: Investor.gov Compound Interest Calculator and CFPB principal-and-interest guidance.',
  ],
};

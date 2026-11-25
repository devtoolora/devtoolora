import { mathError } from './shared';

export function calculateFinance(
  mode: 'compound' | 'loan',
  principal: number,
  annualRatePercent: number,
  years: number,
): Record<string, number> {
  const rate = annualRatePercent / 100;

  if (mode !== 'compound' && mode !== 'loan')
    throw mathError('Choose compound interest or loan payment.');
  if (![principal, annualRatePercent, years].every(Number.isFinite) || principal < 0 || years <= 0)
    throw mathError('Enter finite numbers, a nonnegative principal and a positive duration.');
  if (annualRatePercent < 0) throw mathError('Annual rate must not be negative.');

  if (mode === 'loan') {
    const months = years * 12;

    if (!Number.isSafeInteger(months) || months < 1)
      throw mathError('Loan duration must be a whole number of months.');

    const monthlyRate = rate / 12;
    const payment =
      monthlyRate === 0
        ? principal / months
        : (principal * monthlyRate) / -Math.expm1(-months * Math.log1p(monthlyRate));

    return {
      monthlyPayment: round(payment),
      totalPaid: round(payment * months),
      totalInterest: round(payment * months - principal),
    };
  }

  const amount = principal * (1 + rate) ** years;

  return { futureValue: round(amount), interestEarned: round(amount - principal) };
}

function round(value: number): number {
  if (!Number.isFinite(value) || !Number.isFinite(value * 100))
    throw mathError('Financial result exceeds the numeric range.');

  return Math.round(value * 100) / 100;
}

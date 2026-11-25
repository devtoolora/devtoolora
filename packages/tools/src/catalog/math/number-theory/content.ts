import type { ToolContent } from '@devtoolora/core';

export const content: ToolContent = {
  documentation: [
    {
      content:
        "Number theory studies the integers: how they split into prime factors, which of them are prime, and what divisors they share.\n\nThe prime factorization of an integer is unique, and it gives the number of divisors, their sum and Euler's totient, the count of integers from 1 to n that share no factor with n. The greatest common divisor (GCD) and least common multiple (LCM) of a list describe the factors the integers have in common.",
      title: 'What is number theory?',
    },
    {
      content: [
        'Factor an integer to check a hash table size, a modulus or a puzzle answer.',
        'Check whether a large integer, such as an RSA parameter or a test vector, is prime.',
        'Find the GCD to simplify a ratio, or the LCM to line up periods, frame rates or schedules.',
      ],
      title: 'When to use Number Theory Calculator',
    },
  ],
  examples: [
    '360 factorizes as 2^3 × 3^2 × 5 with 24 divisors, a divisor sum of 1170 and totient 96.',
    '18446744073709551615 (2^64 - 1) factorizes as 3 × 5 × 17 × 257 × 641 × 65537 × 6700417.',
    '97 is prime, so its factorization is 97 and it has 2 divisors.',
    '561 is composite in primality mode, even though it fools the Fermat test as a Carmichael number.',
    '2^127 - 1 is a probable prime, because it is above the deterministic bound.',
    '84, 126, 210 in GCD & LCM mode gives GCD 42 and LCM 1260.',
  ],
  faq: [
    {
      answer:
        'Below 3,317,044,064,679,887,385,961,981 the Miller-Rabin test with the prime bases 2 to 41 is proven correct, so the answer is prime or composite. From that bound on, the test uses the first 20 prime bases: composite is still certain, but a pass is reported as probable prime.',
      question: 'What does probable prime mean?',
    },
    {
      answer:
        'Small factors are removed by trial division up to 10,000. The rest is split with Pollard-Brent rho, and each part is checked with Miller-Rabin until only primes remain.',
      question: 'How is the factorization found?',
    },
    {
      answer:
        'Primes are integers greater than 1, so 1, 0 and negative integers are reported as not prime.',
      question: 'Why is 1 not prime?',
    },
    {
      answer:
        'Signs are ignored, so the GCD and LCM are never negative. Every integer divides 0, so zeros do not change the GCD (a list of only zeros has GCD 0), and the LCM of a list containing 0 is 0.',
      question: 'How are negative numbers and zero handled in GCD & LCM?',
    },
  ],
  help: "Choose a mode: Factorize, Primality or GCD & LCM.\n\nFactorize and Primality take one integer; GCD & LCM takes at least two integers separated by commas, semicolons, spaces or line breaks.\n\nFactorize lists the prime powers, the number of divisors, the sum of divisors and Euler's totient. Primality shows the result, the method and the number of digits.\n\nCopy or save the result as text.",
  notes: [
    'GCD & LCM accepts at most 1,000 integers of at most 1,000 digits each and needs at least two.',
    'Primality accepts one integer of at most 1,000 digits; 1, 0 and negative integers are not prime.',
    'Factorize accepts one integer from 2 to 2^64 - 1 (18446744073709551615).',
    'Primality is deterministic Miller-Rabin with the bases 2 to 41 below 3,317,044,064,679,887,385,961,981; from that bound on, 20 prime bases give a probable prime.',
    'Factorization uses trial division up to 10,000, then Pollard-Brent rho; it stops with an error after 10,000,000 iterations.',
    'Integers are whole decimal numbers with an optional sign; anything else is an error naming the token and its position.',
  ],
};

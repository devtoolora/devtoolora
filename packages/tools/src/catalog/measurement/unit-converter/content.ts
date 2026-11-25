import type { ToolContent } from '@devtoolora/core';

export const content: ToolContent = {
  documentation: [
    {
      content:
        'A unit conversion expresses the same quantity in another unit. Source and target must belong to the same dimension: this tool covers length, storage size and absolute temperature.\n\nLength and storage use scale factors. Temperature also needs an offset: 0 °C is 32 °F and 273.15 K, not zero in every scale.\n\nDecimal storage prefixes use powers of 1000; IEC binary prefixes use powers of 1024. One kB is 1000 B, while one KiB is 1024 B. These are different units, not alternative spellings.',
      title: 'What is unit conversion?',
    },
    {
      content: [
        'Compare metric and international inch/foot/yard/mile measurements.',
        'Check decimal versus binary file sizes without confusing kB with KiB.',
        'Convert an absolute temperature between Celsius, Fahrenheit and Kelvin.',
      ],
      title: 'When to convert units',
    },
  ],
  examples: [
    '1 mi → 1609.344 m; 1 ft → 0.3048 m.',
    '1 in → 2.54 cm.',
    '1000 B → 1 kB, but 1000 B → 0.9765625 KiB.',
    '1048576 B → 1 MiB or 1.048576 MB.',
    '37 °C → 98.6 °F.',
    '0 K → −273.15 °C or −459.67 °F.',
  ],
  faq: [
    {
      answer:
        'Drive makers use decimal gigabytes (1 GB = 1,000,000,000 bytes), while many operating systems report binary gibibytes (1 GiB = 1,073,741,824 bytes). 500 GB converts to 465.66 GiB; no space is missing.',
      question: 'Why does a 500 GB drive show as about 465 GiB?',
    },
    {
      answer:
        'Here kB means 1000 bytes and KiB means 1024 bytes, following SI and IEC prefixes. Choose the unit your source actually uses; the converter never treats them as the same.',
      question: 'Is 1 KB 1000 or 1024 bytes?',
    },
    {
      answer:
        'Length (mm, cm, m, km, in, ft, yd, mi), storage in bytes (B, kB, MB, GB, TB, KiB, MiB, GiB, TiB) and temperature (°C, °F, K). Both units must belong to the same group, so bytes to meters is an error.',
      question: 'Which units can I convert?',
    },
    {
      answer:
        'International: 1 in is exactly 2.54 cm, 1 ft is 0.3048 m and 1 mi is 1609.344 m, so 1 mi converts to exactly 5280 ft. U.S. survey units are not offered.',
      question: 'Are feet and miles international or U.S. survey units?',
    },
    {
      answer:
        'The value is rounded to the chosen Decimal places, so 0.000001 mm in km shows as 0 km with 6 places. Raise Decimal places or choose Report, which keeps the unrounded value.',
      question: 'Why does a very small result show as 0?',
    },
  ],
  help: 'Apply a sample or enter a decimal value, then choose From unit and To unit from the same dimension.\n\nSelect display decimal places. Use Report to inspect the unrounded numeric result alongside the rounded label.\n\nRun the conversion. Incompatible dimensions, negative storage, invalid numbers and temperatures below absolute zero produce an error.\n\nCopy or save the result. Reverse a conversion by exchanging From and To, using the unrounded source for repeated calculations.',
  notes: [
    'Available units: eight length units, nine byte-based storage units and three temperature scales. Bits, throughput, mass, area and volume are not supported.',
    'Feet, yards and miles use international definitions, not historical U.S. survey units. Decimal kB/MB/GB/TB and binary KiB/MiB/GiB/TiB are explicitly separate.',
    'Storage sizes cannot be negative. Signed length values are allowed. Absolute temperature cannot be below 0 K, −273.15 °C or −459.67 °F.',
    'These are absolute temperatures, not temperature differences: converting a 1 °C difference requires a different formula without the offset.',
    'Calculations use JavaScript floating-point numbers. Display rounding is configurable from 0–12 decimal places; Report retains the unrounded numeric result. Tiny results may display as zero.',
    'Input is one decimal number with an optional e exponent, at most 128 raw characters. Commas, grouping, unit suffixes, hex, NaN and Infinity are rejected; integer input must remain within the safe integer range.',
    'Overflow and numeric underflow are rejected rather than returning Infinity or silently losing a nonzero scaled value. Conversion factors do not imply measurement accuracy.',
  ],
};

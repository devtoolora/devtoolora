import type { ToolContent } from '@devtoolora/core';

export const content: ToolContent = {
  documentation: [
    {
      content:
        'Celsius, Fahrenheit and Kelvin are absolute-temperature scales. Their zero points and step sizes differ, so conversion needs a multiplier and sometimes an offset.\n\nKelvin starts at absolute zero. This tool rejects values below 0 K, −273.15 °C or −459.67 °F instead of displaying physically invalid temperatures.\n\nThis dedicated view shows all three scales at once and shares the Unit Converter calculation engine. Report preserves numeric values and includes rounded display labels.',
      title: 'What is temperature conversion?',
    },
    {
      content: [
        'Compare weather or device temperature labels across scales.',
        'Prepare a three-scale display and inspect conversion formulas.',
        'Check a Kelvin value against the absolute-zero boundary.',
      ],
      title: 'When to convert temperatures',
    },
  ],
  examples: [
    '0 °C → 32 °F and 273.15 K.',
    '20 °C → 68 °F and 293.15 K.',
    '−40 °C → −40 °F and 233.15 K.',
    '0 K → −273.15 °C and −459.67 °F.',
    '350 °F with 1 decimal place → 176.7 °C and 449.8 K.',
    'A 10 °C temperature difference is not an absolute temperature of 10 °C; this tool converts only absolute values.',
  ],
  faq: [
    {
      answer:
        '°F = °C × 9/5 + 32 and °C = (°F − 32) × 5/9. Kelvin is °C + 273.15, so 20 °C is 68 °F and 293.15 K.',
      question: 'What is the formula to convert Celsius to Fahrenheit?',
    },
    {
      answer:
        'Nothing can be colder than 0 K, which is −273.15 °C or −459.67 °F. Input below that limit for the selected scale returns an error instead of an impossible temperature.',
      question: 'Why are values below absolute zero rejected?',
    },
    {
      answer:
        'Not with this tool, because its formulas include the offset for absolute temperatures. A change of 10 °C is a change of 18 °F, not 50 °F; multiply a difference by 9/5 yourself.',
      question: 'Can I convert a temperature difference?',
    },
    {
      answer:
        'At −40: −40 °C and −40 °F are the same temperature, 233.15 K. Apply the Where Celsius equals Fahrenheit sample to see it.',
      question: 'At what temperature are Celsius and Fahrenheit equal?',
    },
    {
      answer:
        'Only the displayed labels. The Values output and Report’s formatted labels are rounded to 0–12 places without trailing zeroes, while Report’s celsius, fahrenheit and kelvin numbers stay unrounded.',
      question: 'Does Decimal places change the calculated values?',
    },
  ],
  help: 'Apply a sample or enter a temperature and select its input scale.\n\nSet display decimal places and choose Report or Values. Results update automatically as you change the fields.\n\nReview all three scales. Report keeps unrounded numeric values alongside formatted labels; Values gives three copyable lines.\n\nCopy or save the result. Use Unit Converter for one source-to-target conversion. Do not apply these absolute-temperature formulas to temperature differences.',
  notes: [
    'Calculations run locally and share the Unit Converter engine.',
    'C→F uses C × 9/5 + 32; F→C uses (F − 32) × 5/9; C→K adds 273.15. These formulas are for absolute temperatures only.',
    'Values below absolute zero are rejected in the selected input scale. Negative Celsius/Fahrenheit values above that boundary are valid.',
    'Display precision is 0–12 decimal places with unnecessary trailing zeroes removed. Report numeric values are not display-rounded.',
    'Floating-point arithmetic can leave residual digits in Report. Conversion is not calibrated measurement or an accuracy guarantee.',
    'Input uses a decimal dot and optional e exponent, limited to 128 raw characters. Grouped/localized numbers, unit suffixes, hex and nonfinite values are rejected; integer input must remain safe.',
    'Existing value/unit settings and numeric celsius/fahrenheit/kelvin report keys remain supported. An input scale is never inferred from a suffix.',
  ],
};

import type { ToolContent } from '@devtoolora/core';

export const content: ToolContent = {
  documentation: [
    {
      content: [
        'Colors are converted to linear sRGB and multiplied by the Machado, Oliveira and Fernandes (2009) matrix for the chosen type and severity, with one matrix per 10% step. The result is clamped to 0-1 and encoded back to sRGB.',
        'Achromatopsia mixes each linear channel toward the luminance Y = 0.2126 R + 0.7152 G + 0.0722 B by the severity.',
        'A pair is flagged when its OKLab distance in a simulation is below 0.08. Pairs that are already below 0.08 in normal vision are flagged as close for everyone instead.',
      ],
      title: 'How is the palette simulated?',
    },
    {
      content: [
        'Checking a chart palette before it ships.',
        'Finding red and green pairs that collapse for deuteranopia.',
        'Choosing status colors that stay distinct without color alone.',
        'Documenting accessibility checks for a design system.',
      ],
      title: 'When to use Color Blindness Palette Simulator',
    },
  ],
  examples: [
    '#2ca02c, #d62728 is flagged for deutan',
    '#1f77b4, #ff7f0e has no flags',
    '#ff0000 at 100% deutan becomes #a39000',
    '#2563eb at 50% deutan becomes #0065ea',
    'Severity 0 changes nothing, so distinct colors stay unflagged',
    'rgb(37, 99, 235), tomato keeps the comma inside rgb() together',
  ],
  faq: [
    {
      answer: 'Protan lacks red cones, deutan lacks green cones, tritan lacks blue cones.',
      question: 'What do protan, deutan and tritan mean?',
    },
    {
      answer: 'Anomalous trichromacy is partial, and achromatopsia is the absence of color vision.',
      question: 'What does severity change?',
    },
    {
      answer: 'The simulation needs a solid color, so rgba() and similar values are rejected.',
      question: 'Why are transparent colors rejected?',
    },
    {
      answer: 'The model is an approximation, so treat the flags as a guide and test with users.',
      question: 'Is the result exact?',
    },
  ],
  help: 'Enter 2-12 opaque CSS colors separated by commas or new lines.\n\nPick a severity and at least one vision type.\n\nThe summary names up to five hard-to-tell pairs, and the table lists the simulated color of every palette entry for each type. Copy or Save gives the full text with every flagged pair and its normal and simulated distances.\n\nThe preview has one row per color and one column per view. A cell that is hard to tell apart is outlined and names the other color, for example ≈2.',
  notes: [
    'The palette needs 2-12 colors.',
    'Commas inside rgb() or hsl() do not split.',
    'Severity runs from 0 to 100 in steps of 10.',
    'At least one vision type must be selected.',
    'Distances are OKLab differences.',
    'Alpha is rejected rather than ignored.',
  ],
};

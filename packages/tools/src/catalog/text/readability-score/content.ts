import type { ToolContent } from '@devtoolora/core';

export const content: ToolContent = {
  documentation: [
    {
      content: [
        'The readability score estimates how hard English text is to read. It reports the Flesch reading ease, the Flesch-Kincaid grade level and the Gunning fog index. It runs locally in your browser or editor.',
        'Higher Flesch values mean easier text, while the grade and fog values approximate the years of schooling a reader needs.',
      ],
      title: 'What does the readability score do?',
    },
    {
      content: [
        'Words are runs of English letters, with an apostrophe allowed inside a word. Sentences end at a period, question mark or exclamation mark followed by whitespace or the end of the text.',
        'Syllables are estimated by counting vowel groups after trimming silent endings, so the numbers are close but not exact. Complex words have three or more syllables.',
      ],
      title: 'How the numbers are computed',
    },
  ],
  examples: [
    'The cat sat on the mat. \u2192 Flesch 116.1 \u00B7 grade -1.4 \u00B7 fog 2.4',
    'Readability formulas estimate difficulty. Short words help. \u2192 Flesch -14.3 \u00B7 grade 16.1',
    'Flesch 60 to 70 is plain English that most adults follow',
    'Switch to JSON to get all counts as an object',
  ],
  faq: [
    {
      answer:
        'The formulas are tuned for English. Other languages have different syllable patterns, so the scores are not meaningful, and non-English letters are ignored.',
      question: 'Does it work for other languages?',
    },
    {
      answer:
        'Scores above 100 or below zero are normal for very short or very long sentences. The formula is not clamped, so treat them as extremes of easy or hard.',
      question: 'Why is the score above 100 or negative?',
    },
    {
      answer:
        'Syllables are counted by a vowel-group heuristic rather than a dictionary. It is fast and consistent, but some words are off by one, which shifts the scores slightly.',
      question: 'How accurate is the syllable count?',
    },
    {
      answer:
        'Input is limited to 1,000,000 characters and must contain at least one English word. Text without any is rejected with a message.',
      question: 'Are there size limits?',
    },
  ],
  help: 'Paste English text to score it.\n\nThe report lists each score with a band such as Standard or College, followed by word, sentence, syllable and complex word counts.\n\nChoose JSON to get the same numbers as an object.\n\nA Flesch score of 60 to 70 is generally easy for most adults, while lower scores need more education to read.',
  notes: [
    'Input is limited to 1,000,000 characters.',
    'Scores are designed for English text only.',
    'Syllables are estimated, so scores are approximate.',
  ],
};

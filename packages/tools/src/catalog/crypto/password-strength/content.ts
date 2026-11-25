import type { ToolContent } from '@devtoolora/core';

export const content: ToolContent = {
  documentation: [
    {
      content: [
        'This tool observes length, character categories and a few predictable patterns. Legacy weak/medium/strong labels mean checklist coverage, not measured resistance to cracking.',
        'The score awards two points for 12 code points, one for mixed ASCII case, one for a digit, one for a non-letter/digit character and one for whitespace or 20 code points. Common prefixes, repeated blocks and whitespace-only input cap it at two.',
        'No password is echoed in the report. There is no dictionary model, breach lookup, entropy calculation or crack-time estimate.',
      ],
      title: 'What is a password checklist?',
    },
    {
      content: [
        'Spot short or obviously repeated development examples.',
        'Compare exact lengths, including whitespace and Unicode code points.',
        'Read the limitations; use independent breach screening and an appropriate production authentication policy.',
      ],
      title: 'When to use Password Strength',
    },
  ],
  examples: [
    'Password123! → score 2, weak, commonPattern true despite mixed categories.',
    'Aa1!Aa1!Aa1!Aa1!Aa1! → score 2, weak, repeatedPattern true.',
    '" leading spaces " → length 16, score 4, medium; the spaces count.',
    '🐎kůň漢字42! → length 9 code points, not 10 UTF-16 units, score 2, weak.',
    'correct horse battery staple 42! → score 5, strong, with a warning to mix upper and lower case.',
  ],
  faq: [
    {
      answer:
        'No. The checklist runs on your device without any network request, and the JSON report holds only the length, checks and warnings, never the password itself.',
      question: 'Is my password sent anywhere?',
    },
    {
      answer:
        'No. Only a tiny built-in list of common starts, such as password, qwerty and 123456, is checked. Screen passwords against real leaks with a breach service such as Have I Been Pwned’s Pwned Passwords.',
      question: 'Does it check whether my password was leaked?',
    },
    {
      answer:
        'Because it ticks every box: 12 characters, mixed case, a digit and a symbol. Look-alike swaps such as 0 for o are undone only for the tiny list of common starts, so P@ssw0rd is caught, but there is no dictionary to recognize troubadour. Dictionary words with letter swaps are how such passwords get cracked, so read strong as checklist coverage only.',
      question: 'Why is Tr0ub4dour&3 rated strong?',
    },
    {
      answer:
        'correcthorsebatterystaple scores 3 of 6: its length earns points, but it has no uppercase, digit or symbol. A long passphrase of randomly chosen words can be strong in practice; the checklist simply does not measure word randomness.',
      question: 'Why is my long passphrase only rated medium?',
    },
    {
      answer:
        'A score of 5 or 6 out of 6 on this checklist. It means the password has length and variety, not that it is uncrackable, unique or absent from leaks.',
      question: 'What does a strong rating mean?',
    },
  ],
  help: 'Enter the Password in the masked field; it is excluded from saved input drafts.\n\nRun explicitly. Empty input fails; spaces are preserved. API limit: 10000 UTF-16 units.\n\nRead method, checks, warnings and notice before the rating. This is not a security certificate.\n\nCopy/download password-strength.json. It contains observations, not the password.',
  notes: [
    'A high checklist score does not prove an unguessable password.',
    'The common-prefix list is small, not a breach database; look-alike swaps such as P@ssw0rd still match it.',
    'Category suggestions are not mandatory password rules.',
    'Unicode character categories beyond ASCII letters are not modeled in detail.',
    'No hashing, network request or crack attempt occurs.',
    'Exported lengths and checks can still reveal information; share reports thoughtfully.',
  ],
};

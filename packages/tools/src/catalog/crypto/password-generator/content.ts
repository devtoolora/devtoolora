import type { ToolContent } from '@devtoolora/core';

export const content: ToolContent = {
  documentation: [
    {
      content: [
        'Creates random passwords by uniformly sampling enabled character groups with Web Crypto.',
        'Symbols are enabled by default. Groups define allowed characters, not per-group inclusion requirements.',
        'This tool does not certify strength or check breaches. Usefulness depends on length, storage and service rules.',
      ],
      title: 'What is a random password?',
    },
    {
      content: [
        'Create development passwords and test-account fixtures.',
        'Match allowed characters and length to service rules.',
        'Use a password manager for production-account storage.',
      ],
      title: 'When to use Password Generator',
    },
  ],
  examples: [
    'Length 20 with all four groups → 20 characters such as }8YPmVLe_w0wXlvN^RIO.',
    'Length 6 with only Numbers → a PIN such as 457704; fine for a PIN, weak as a general password.',
    'Length 24 with Numbers and Symbols off → letters only, for services that reject symbols.',
    'Count 10 → ten passwords, one per line.',
    'Length 513 → error: Length must be an integer between 1 and 512.',
  ],
  faq: [
    {
      answer:
        'For accounts stored in a password manager, 16–20 random characters from all four groups is plenty: 20 characters from the 85-character set carry about 128 bits. If a service allows only letters or digits, use the longest length it accepts.',
      question: 'How long should a generated password be?',
    },
    {
      answer:
        'Yes. Every character comes from crypto.getRandomValues with rejection sampling, so each allowed character is equally likely. Passwords are created on your device and are not sent anywhere.',
      question: 'Are the passwords generated securely?',
    },
    {
      answer:
        'Not necessarily. Enabled groups decide which characters may appear, not a minimum per group, so a password can miss one by chance. If a site insists on one of each, generate again.',
      question: 'Does every password include a digit, a symbol and a capital letter?',
    },
    {
      answer:
        'No. It generates random characters only and has no word list. For a memorable master password, use the passphrase option of your password manager or a diceware word list.',
      question: 'Can it make a passphrase of words?',
    },
    {
      answer:
        'Only where the system limits guesses, such as a phone or card PIN. Six digits allow just one million combinations, which an attacker who can guess offline tries in moments.',
      question: 'Is a 6-digit PIN a safe password?',
    },
  ],
  help: 'Choose whole Length 1…512 and Count 1…100.\n\nEnable a group. Symbols use !@#$%^&*()-_=+[]{};:,.? rather than all Unicode punctuation.\n\nRun explicitly; settings clear exports without automatically regenerating passwords.\n\nCopy/download password-generator.txt intentionally; output is one password per line.',
  notes: [
    'Uses the same unbiased sampler as Token Generator.',
    'Selected groups need not all appear; inspect destination requirements.',
    'No dictionary, passphrase, breach lookup or strength certification.',
    'Short numeric-only values are not strong general-purpose passwords.',
    'Generated values are not saved into input drafts.',
    'Clipboard/downloaded files expose the passwords; store them appropriately.',
  ],
};

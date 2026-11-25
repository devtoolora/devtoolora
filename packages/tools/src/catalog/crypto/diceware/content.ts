import type { ToolContent } from '@devtoolora/core';

export const content: ToolContent = {
  documentation: [
    {
      content: [
        'Diceware builds a passphrase from random words instead of random characters. Each word is picked from a list of 7,776 entries, the number of outcomes of five six-sided dice, so every word adds about 12.9 bits of entropy.',
        'Six words give roughly 77.5 bits, which is far beyond what an offline attacker can guess against a slow password hash, and a phrase of ordinary words is easier to remember and type than a string of symbols.',
        'This tool uses the EFF long word list and your browser random number generator. You can also enter rolls of physical dice and get the matching words, which keeps the randomness entirely in your hands. Everything runs locally.',
      ],
      title: 'What is Diceware Passphrase Generator?',
    },
    {
      content: [
        'Create a master password, a disk encryption passphrase or a password manager vault passphrase that you have to remember and type by hand.',
        'Convert real dice rolls into words when you do not want to trust any software random generator.',
        'For sites that need a random string rather than words, use the password generator instead.',
      ],
      title: 'When to use Diceware Passphrase Generator',
    },
  ],
  examples: [
    'Defaults: six words separated by spaces, 77.5 bits.',
    'Five words, dash separator and Capitalize words → Word-Word-Word-Word-Word.',
    'Rolls 11111 and 66666 → abacus zoom.',
    'Eight words with underscores → word_word_..., 103.4 bits.',
    'Four words with Add a digit → one digit appended to a random word, 55.0 bits.',
    'Count 3 with seven words → three separate passphrases, one per line.',
  ],
  faq: [
    {
      answer:
        'Six words from the 7,776-word list give about 77.5 bits, which is strong for most uses. Seven or eight words are a good choice for a password manager master passphrase.',
      question: 'How many words should I use?',
    },
    {
      answer:
        'Only if the words are chosen randomly, which this tool does. Capitalizing and a digit add little entropy, so they mainly help with sites that demand them.',
      question: 'Is a phrase of ordinary words really secure?',
    },
    {
      answer:
        'Roll five dice, read them in order as one five-digit number such as 43251, and enter one number per line. Each roll maps to exactly one word of the list.',
      question: 'How do I use physical dice?',
    },
    {
      answer:
        'The generated phrase exists only in this page and is never sent anywhere. Dice rolls stay out of saved drafts, because they reproduce the phrase. Generation allows 1 to 20 words and 1 to 20 passphrases; dice rolls are limited to 1,000 lines.',
      question: 'Is anything stored or sent?',
    },
  ],
  help: 'Leave the input empty to generate passphrases: choose the number of words and passphrases, a separator and optionally capitalized words or an added digit.\n\nTo use physical dice instead, enter five digits from 1 to 6 per word, separated by new lines or spaces. The words and passphrase count fields are then ignored.\n\nThe summary shows the word count and the entropy in bits.\n\nCopy the result, send it to the scratchpad or save it as a text file.',
  notes: [
    'The word list is the EFF long list of 7,776 words, in dice order from 11111 (abacus) to 66666 (zoom).',
    'The list is published by the Electronic Frontier Foundation under the Creative Commons Attribution 3.0 license (CC BY 3.0).',
    'Each word adds log2(7776), about 12.92 bits; an added digit adds about 3.32 bits.',
    'Random numbers come from the Web Crypto generator, with rejection sampling so every word is equally likely.',
    'Generation is limited to 20 words and 20 passphrases; dice rolls are limited to 1,000 lines.',
    'Dice roll errors name the line and the token that is not five digits from 1 to 6.',
    'Capitalizing words and adding a digit do not meaningfully increase strength; add a word instead.',
  ],
};

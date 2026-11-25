import type { ToolContent } from '@devtoolora/core';

export const content: ToolContent = {
  documentation: [
    {
      content: [
        'DNS only carries ASCII letters, digits and hyphens. Internationalized domain names (IDN) such as münchen.de are therefore stored as Punycode (RFC 3492): each non-ASCII label becomes the prefix xn-- followed by an ASCII encoding, for example xn--mnchen-3ya.',
        'Browsers show the Unicode form and send the xn-- form. Everything runs locally in your browser or editor.',
      ],
      title: 'What is Punycode?',
    },
    {
      content: [
        'Each label goes through the same IDNA mapping as a URL in your browser or editor before encoding: letters are lowercased, compatibility forms are normalized and invisible characters such as the soft hyphen are removed. The ideographic full stop, fullwidth full stop and halfwidth ideographic full stop are treated as dots. A label that mapping does not allow is an error. Labels that are already ASCII are only lowercased.',
        'A label that mixes letters from Latin, Cyrillic and Greek is flagged. Such names can imitate another domain, for example a Cyrillic a inside a Latin word, and are a common phishing trick.',
      ],
      title: 'Normalization and homograph warnings',
    },
  ],
  examples: [
    'münchen.de → xn--mnchen-3ya.de',
    'Bücher.DE → xn--bcher-kva.de',
    'xn--bcher-kva.example → bücher.example',
    'user@münchen.de → user@xn--mnchen-3ya.de',
  ],
  faq: [
    {
      answer:
        'Enter one domain per line and pick To ASCII or To Unicode. Blank lines are skipped. Each line becomes one row in the table with its input, output and any warning.',
      question: 'How do I convert several domains at once?',
    },
    {
      answer:
        'The text before the last @ is kept as it is and only the domain part is converted, so an email address such as user@münchen.de becomes user@xn--mnchen-3ya.de.',
      question: 'Can I paste an email address?',
    },
    {
      answer:
        'No. Enter only the host, such as münchen.de. A value with a scheme, port, path or spaces, such as https://münchen.de/path, is an error that names the line, because those characters cannot be part of a domain name.',
      question: 'Can I paste a full URL?',
    },
    {
      answer:
        'It means the label mixes Latin, Cyrillic or Greek letters. Lookalike characters from another script can make a fake domain look genuine, so check the name before you trust it.',
      question: 'What does a homograph warning mean?',
    },
    {
      answer:
        'The label after xn-- is not valid Punycode, or it does not encode back to the same text, or it holds only ASCII characters. The error names the line and the label.',
      question: 'Why is an xn-- label rejected?',
    },
  ],
  help: 'Pick To ASCII or To Unicode and paste one domain per line.\n\nIn To ASCII mode every label with non-ASCII characters is converted to its xn-- form. In To Unicode mode xn-- labels are decoded and other labels are only lowercased.\n\nThe table lists the input, the output and a warning when a label mixes Latin, Cyrillic and Greek letters.\n\nThe summary shows the number of domains and, when present, the number of warnings. Errors name the line, for example Line 1: label exceeds 63 characters.',
  notes: [
    'A converted domain may be at most 253 characters long.',
    'Input is limited to 1,000 lines.',
    'A converted label may be at most 63 characters long.',
    'The conversion does not check registry rules or whether a domain is registered.',
  ],
};

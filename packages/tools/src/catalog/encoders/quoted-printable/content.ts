import type { ToolContent } from '@devtoolora/core';

export const content: ToolContent = {
  documentation: [
    {
      content: [
        'Quoted-printable (RFC 2045) is the MIME encoding used for email bodies that are mostly ASCII. Printable ASCII stays as it is, and every other byte becomes an equals sign followed by two hex digits, for example é in UTF-8 is =C3=A9.',
        'Lines are wrapped at 76 characters with a soft line break, an equals sign at the end of the line. Everything runs locally in your browser or editor.',
      ],
      title: 'What is quoted-printable?',
    },
    {
      content: [
        'Email headers cannot hold raw non-ASCII text, so RFC 2047 wraps it in encoded words such as =?UTF-8?Q?Caf=C3=A9?= or =?UTF-8?B?...?=. Q words use the quoted-printable style with an underscore for a space, B words use base64.',
        'Whitespace between two adjacent encoded words is dropped, and adjacent words in the same charset are joined before decoding so a character split across words survives.',
      ],
      title: 'MIME encoded words in headers',
    },
  ],
  examples: [
    'Café = 5€ → Caf=C3=A9 =3D 5=E2=82=AC',
    'Caf=C3=A9=⏎ au lait → Café au lait',
    'Andr=E9 (ISO-8859-1) → André',
    '=?UTF-8?Q?Caf=C3=A9?= menu → Café menu',
  ],
  faq: [
    {
      answer:
        'The decoder reads the bytes with the charset you pick. Messages from older clients often use ISO-8859-1 or Windows-1250, so switch the charset if UTF-8 reports invalid text.',
      question: 'Why does decoding say the text is not valid?',
    },
    {
      answer:
        'A trailing space or tab before a line break would be lost in transit, so the encoder writes it as =20 or =09. Spaces inside a line stay literal.',
      question: 'Why is a trailing space encoded?',
    },
    {
      answer:
        'The browser label iso-8859-1 is treated as windows-1252 by the WHATWG decoder, which differs only for bytes 0x80 to 0x9F. Pick Windows-1252 explicitly if that matters.',
      question: 'Is ISO-8859-1 decoded strictly?',
    },
    {
      answer:
        'Switch the mode to MIME header decode and paste the header. Plain text around the encoded words is kept and every =?charset?Q?...?= or =?charset?B?...?= word is replaced.',
      question: 'How do I read an encoded Subject header?',
    },
  ],
  help: 'Pick a mode and paste your text.\n\nEncode turns the text into UTF-8 quoted-printable with soft line breaks at 76 characters. Line breaks are written as LF.\n\nDecode reverses it using the charset you choose, joins soft line breaks and strips trailing whitespace from each line.\n\nMIME header decode replaces RFC 2047 encoded words in a header line with their text.\n\nErrors name the 1-based position of the bad sequence, for example Invalid quoted-printable sequence at position 4.',
  notes: [
    'Decoding rejects raw non-ASCII and control characters; they must be written as =XX.',
    'Input is limited to 1,000,000 characters.',
    'Input line breaks (CRLF, CR, LF) are written as LF.',
    'The ISO-8859-1 label decodes as Windows-1252, as in browsers.',
    'Encoded output is not checked against any mail server limits other than the 76 character line length.',
  ],
};

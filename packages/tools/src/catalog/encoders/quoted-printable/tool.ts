import { ToolDefinition } from '@devtoolora/core';
import {
  decodeMimeHeader,
  decodeQuotedPrintable,
  encodeQuotedPrintable,
  type QpCharset,
} from '@devtoolora/functions/encoding';
import { withToolError } from '../../../adapters/errors';
import { choiceField } from '../../../adapters/fields';
import { browserSafeCapabilities } from '../shared';

const charsets: readonly QpCharset[] = [
  'utf-8',
  'iso-8859-1',
  'iso-8859-2',
  'windows-1250',
  'windows-1252',
];
const modes = ['encode', 'decode', 'header'] as const;

function countLines(text: string): string {
  const count = text === '' ? 0 : text.split(/\r\n|\r|\n/).length;

  return `${count} ${count === 1 ? 'line' : 'lines'}`;
}

function convert(mode: (typeof modes)[number], text: string, charset: QpCharset): string {
  if (mode === 'encode') return encodeQuotedPrintable(text);

  return mode === 'decode' ? decodeQuotedPrintable(text, charset) : decodeMimeHeader(text);
}

export const quotedPrintableTool: ToolDefinition = {
  capabilities: browserSafeCapabilities,
  category: 'Encoders',
  description:
    'Encode and decode quoted-printable (MIME) text in several charsets and decode RFC 2047 encoded-word email headers.',
  fields: [
    {
      defaultValue: 'encode',
      id: 'mode',
      label: 'Mode',
      options: [
        { label: 'Quoted-printable encode', value: 'encode' },
        { label: 'Quoted-printable decode', value: 'decode' },
        { label: 'MIME header decode (RFC 2047)', value: 'header' },
      ],
      type: 'select',
    },
    {
      defaultValue: 'utf-8',
      id: 'charset',
      label: 'Charset',
      options: [
        { label: 'UTF-8', value: 'utf-8' },
        { label: 'ISO-8859-1 (Latin-1)', value: 'iso-8859-1' },
        { label: 'ISO-8859-2 (Latin-2)', value: 'iso-8859-2' },
        { label: 'Windows-1250', value: 'windows-1250' },
        { label: 'Windows-1252', value: 'windows-1252' },
      ],
      type: 'select',
      visibleWhen: { field: 'mode', is: ['decode'] },
    },
  ],
  freshResults: true,
  id: 'quoted-printable',
  inputKind: 'text',
  keywords: [
    'quoted-printable',
    'qp',
    'mime',
    'email',
    'rfc 2045',
    'rfc 2047',
    'header',
    'encoded-word',
  ],
  name: 'Quoted-Printable & MIME Header Decoder',
  outputKind: 'text',
  relatedToolIds: ['base64-encode', 'url-encode', 'base-n-encoder'],
  resultActions: ['copy', 'replace', 'insert', 'scratch', 'save'],
  run: ({ fields, text }) =>
    withToolError(() => {
      const mode = choiceField(fields.mode, 'encode', modes, 'Choose a mode.');
      const charset = choiceField(fields.charset, 'utf-8', charsets, 'Choose a charset.');
      const output = convert(mode, text, charset);

      return {
        language: 'plaintext',
        summary: `${mode} · ${countLines(output)}`,
        text: output,
      };
    }),
  samples: [
    { fields: { mode: 'encode' }, label: 'Accents and equals', text: 'Café = 5€' },
    { fields: { mode: 'encode' }, label: 'Czech sentence', text: 'Příliš žluťoučký kůň' },
    { fields: { mode: 'decode' }, label: 'Decode UTF-8', text: 'Caf=C3=A9=\n au lait' },
    {
      fields: { charset: 'iso-8859-1', mode: 'decode' },
      label: 'Decode Latin-1',
      text: 'Andr=E9 Martin',
    },
    {
      fields: { mode: 'header' },
      label: 'Header with Q word',
      text: 'Subject: =?UTF-8?Q?Caf=C3=A9?= menu',
    },
    {
      fields: { mode: 'header' },
      label: 'Header with B and Q words',
      text: '=?UTF-8?B?w4lsw6h2ZQ==?= =?ISO-8859-1?Q?Andr=E9_Martin?=',
    },
  ],
  supportsSelection: true,
};

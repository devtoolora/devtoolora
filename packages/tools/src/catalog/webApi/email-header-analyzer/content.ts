import type { ToolContent } from '@devtoolora/core';

export const content: ToolContent = {
  documentation: [
    {
      content: [
        'An email header block records how a message traveled. Every server that handles it adds a Received line, and the receiving server adds an Authentication-Results line with the SPF, DKIM and DMARC verdicts.',
        'This tool reads a pasted header block, unfolds wrapped lines, orders the Received hops from the first server to the last and works out how long the message waited at each one.',
        'It also lists the sender headers (From, Reply-To, Return-Path, To, Subject, Date, Message-ID), each DKIM-Signature domain, selector and algorithm, and a list of findings sorted from high to info. RFC 2047 encoded words in From, Reply-To, To and Subject are decoded for display.',
      ],
      title: 'What is an email header analyzer?',
    },
    {
      content: [
        'Use it to check a suspicious message: a Reply-To on another domain, a failed DMARC result or two From headers are the usual signs of spoofing.',
        'Use it to find where a delivery was delayed. A hop that waited over an hour is flagged with the server it waited for.',
        'Use Email Normalizer for single addresses, HTTP Headers Parser for plain header lists and Secret Redactor before sharing a block that holds internal host names.',
      ],
      title: 'When to use Email Header Analyzer',
    },
  ],
  examples: [
    'Two Received lines 10 seconds apart, SPF, DKIM and DMARC all pass → 2 hops, 10 s transit and a Reply-To warning.',
    'Reply-To: help@scam.example with From: support@bank.example → medium finding for the different domain.',
    'dmarc=fail in Authentication-Results → high finding, DMARC result is fail.',
    'Two Received lines two hours apart → medium finding, Hop 2 waited 7,200 s.',
    'No Date and no Message-ID → two medium findings.',
    'An mbox copy starting with a From line and a body → the From line and the body are ignored.',
  ],
  faq: [
    {
      answer:
        'Servers add their Received line on top, so the first line is the last server. The report reverses the list and shows the hops in the order the message traveled.',
      question: 'Why are the hops in reverse order?',
    },
    {
      answer:
        'No. Nothing is fetched. The results are the ones the receiving server wrote into Authentication-Results, and Received-SPF is used only when that header has no SPF result.',
      question: 'Does the tool check SPF, DKIM or DMARC itself?',
    },
    {
      answer:
        'Each server uses its own clock, so a hop can look earlier than the previous one. This is reported as an info finding (clock skew) and the delay is shown as a negative number.',
      question: 'What does a negative delay mean?',
    },
    {
      answer:
        'The Received line has no date after its last semicolon or the date is not RFC 5322 shaped. The hop is listed without a timestamp and a low finding says so.',
      question: 'Why does a hop have no timestamp?',
    },
  ],
  help: 'Paste the full header block of a message. Your mail client has it under Show original, View source or Message headers.\n\nThe analysis stops at the first blank line, so a pasted body is ignored, and a leading mbox From line is skipped.\n\nThe result is JSON with the sender fields, the Received hops with delays, the authentication results, DKIM signatures and findings.\n\nNothing leaves the page and no DNS lookup is made.',
  notes: [
    'Input is at most 1,048,576 characters and at most 500 Received headers; a line that is not a Name: value header is rejected.',
    'Folded lines are joined with one space. Header names are matched case-insensitively and the first header of a name is used, except for From and Received, which are counted.',
    'Findings: two From headers and failed SPF, DKIM or DMARC are high; DMARC none, no Authentication-Results, a Reply-To domain mismatch, a missing Date or Message-ID, or a Date over 86,400 s from the first hop are medium.',
    'A hop that waited over 3,600 s is medium; a hop without a readable timestamp is low; a hop earlier than the previous one is info (clock skew).',
    'Return-Path domain mismatch, List-Unsubscribe, Precedence: bulk and X-Mailer are info.',
    'Dates follow RFC 5322: optional weekday and seconds, two-digit years (00-49 read as 20xx), numeric zones, UT, GMT, the US zone names; other zone names are read as UTC.',
  ],
};

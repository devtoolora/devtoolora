import type { ToolContent } from '@devtoolora/core';

export const content: ToolContent = {
  documentation: [
    {
      content:
        'URL encoding, also called percent-encoding, represents selected bytes as a percent sign followed by two hexadecimal digits, such as %20 for a space.\n\nThis tool uses UTF-8, so a character can become more than one escape sequence: č becomes %C4%8D.\n\nCharacters such as /, ?, & and # can define the structure of a URL; encoding them inside a value keeps them as data instead of separators.',
      title: 'What is URL encoding?',
    },
    {
      content: [
        'Prepare a search term, one path segment, or a redirect URL to insert as a parameter value; encode the value before assembling the link.',
        'Read an escaped value from a request, log or copied link, using the context that produced it.',
        'Convert an individual UTF-8 form value for application/x-www-form-urlencoded; use the Query String Parser for a complete query string or the URL Parser to inspect URL parts.',
      ],
      title: 'When to use URL Encode / Decode',
    },
  ],
  examples: [
    'Component encode: a+b c → a%2Bb%20c',
    'Component encode: čau & ahoj → %C4%8Dau%20%26%20ahoj',
    'Component decode: a+b → a+b; form decode: a+b → a b',
    'Complete URL encode: https://example.com/a b?q=hello → https://example.com/a%20b?q=hello',
    'Complete URL decode: https://example.com/?q=A%26B → https://example.com/?q=A%26B (reserved separator stays escaped)',
    'Form encode: a+b c → a%2Bb+c; form decode: a%2Bb+c → a+b c',
  ],
  faq: [
    {
      answer:
        'Both can stand for a space, but + means a space only in form-encoded data, such as an HTML form query string. Component mode writes %20 and keeps + literal when decoding; Form value mode writes + and decodes + as a space.',
      question: 'What is the difference between %20 and + in URLs?',
    },
    {
      answer:
        'Use Component for one value you insert into a link, such as a search term or redirect URL; like encodeURIComponent, it escapes / ? & = and #. Use Complete URL, which works like encodeURI, only for an already assembled address whose separators should stay.',
      question: 'Should I use Component or Complete URL mode?',
    },
    {
      answer:
        'It was encoded twice: %25 is the escape for the percent sign, so %2520 is an encoded %20. Decode once to get %20 back, or encode from the plain text; each run of this tool performs exactly one pass.',
      question: 'Why does my URL contain %2520?',
    },
    {
      answer:
        "Letters, digits and - _ . ! ~ * ' ( ) stay as they are in Component mode. Form value mode also escapes ! ' ( ) and ~, while Complete URL additionally keeps ; , / ? : @ & = + $ and #.",
      question: 'Which characters stay unencoded?',
    },
    {
      answer:
        'Every % must start a two-digit hex escape, and the decoded bytes must be valid UTF-8. Inputs such as 100% or %E9, a Latin-1 é, are rejected instead of guessed; write a literal percent sign as %25.',
      question: 'Why does decoding fail with malformed percent escapes?',
    },
  ],
  help: 'Choose Encode for plain text or Decode for an escaped value, then select the URL context that matches your task.\n\nComponent / query value is for one path segment or parameter value, not a whole URL; spaces become %20, and decoding leaves a literal + unchanged.\n\nComplete URL preserves structural separators such as :, /, ?, &, = and # while encoding spaces and Unicode text.\n\nForm value is for one application/x-www-form-urlencoded value; spaces become +, literal plus signs become %2B, and decoding reverses these rules.\n\nRun the conversion, copy the result, or use “Use result & reverse” to move the output into the input and switch direction.',
  notes: [
    'Choose the context yourself; the tool does not guess whether a plus is text or a space.',
    'Complete URL assumes separators are intentional; encode data such as A&B as a component before assembling a link, because this mode cannot distinguish a data ampersand from a parameter separator.',
    'Complete URL decoding retains escapes for reserved separators: %26 stays %26 rather than becoming &.',
    'Decoding performs exactly one pass: %252F becomes %2F, not /; malformed percent escapes and invalid UTF-8 are errors.',
    'Encoding also performs one pass and escapes an existing percent sign: %20 becomes %2520, so start from plain text unless another encoding layer is intentional.',
    'Encoding is not encryption or URL validation; the tool converts text without fetching the address.',
    'The original URL Decode entry point defaults to form-value context to preserve its historical plus-as-space behavior.',
  ],
};

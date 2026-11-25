import type { ToolContent } from '@devtoolora/core';

export const content: ToolContent = {
  documentation: [
    {
      content: [
        'An absolute URL contains a scheme and scheme-specific address components. This tool uses the platform URL parser to expose protocol, credentials, host, path, search and fragment.',
        'HTTP-style hosts are normalized by the platform; default ports may disappear and Unicode domains may become ASCII IDN names. Paths/search remain encoded strings.',
        'Query parameters are separately decoded with URLSearchParams. Repeated names become arrays rather than losing all but the last value.',
      ],
      title: 'What is URL parsing?',
    },
    {
      content: [
        'Inspect routing paths, encoded queries, fragments or explicit ports.',
        'Compare parsed hostname with a raw address while debugging.',
        'Use Query String Parser for rebuilding parameters; do not use successful parsing as a safety or reachability check.',
      ],
      title: 'When to use URL Parser',
    },
  ],
  examples: [
    'https://example.com:8443/path?q=1#top → port "8443", pathname "/path", hash "#top".',
    'https://example.com:443/ → port "", because 443 is the default for https.',
    'https://example.com/search?tag=a&tag=b → params.tag ["a", "b"].',
    '?space=dev+tools&plus=dev%2Btools → params.space "dev tools" and params.plus "dev+tools".',
    'https://demo:demo-password@example.com/ → username "demo", password "<redacted>".',
    'https://bücher.example/ → hostname "xn--bcher-kva.example".',
    '/path → error, because no base URL is supplied.',
  ],
  faq: [
    {
      answer:
        'No. It only splits the text with the URL parser built into your browser or editor. Nothing is requested and no DNS lookup runs, so a successful parse says nothing about whether the address is safe or reachable.',
      question: 'Does the URL Parser visit or check the URL?',
    },
    {
      answer:
        'The parser drops a port that equals the scheme’s default, such as 443 for https and 80 for http, so port is an empty string. Any other port, such as :8443, is kept.',
      question: 'Why is the port empty when my URL contains :443?',
    },
    {
      answer:
        'params is decoded with URLSearchParams, which follows HTML form rules: + means a space and %2B means a literal plus. The search field keeps the original encoded text, so you can compare both.',
      question: 'Why does a + in the query turn into a space?',
    },
    {
      answer:
        'The platform parser converts hostnames to their ASCII (Punycode) form, so bücher.example becomes xn--bcher-kva.example. Non-ASCII characters in the path and query are percent-encoded, while params shows them decoded.',
      question: 'Why does my Unicode domain show up as xn--?',
    },
    {
      answer:
        'No. The input needs a scheme such as https://, because there is no base URL to resolve against. Put a placeholder origin in front, for example https://example.com/api/items, if you only need the path and query.',
      question: 'Can I parse a relative URL such as /api/items?',
    },
  ],
  help: 'Paste an absolute URL with a scheme, or apply a sample.\n\nRun parsing and inspect the expandable JSON report.\n\nDistinguish encoded search from decoded params and inspect repeated values.\n\nCopy or download the JSON report. Password redaction does not sanitize tokens in the path/query/fragment.',
  notes: [
    'Input is limited to 65,536 UTF-16 characters.',
    'The platform parser may normalize or tolerate unusual spellings. Parsing is not strict source-text validation.',
    'No request, DNS lookup, safety check, redirect resolution or navigation occurs.',
    'Relative paths and a configurable base are unsupported. Opaque schemes may have empty host fields.',
    'Username, query values and fragments remain visible. Only the URL credential password property is masked.',
    'Parameter names and decoded values are case-sensitive. Bracket notation is a literal name, not nested data.',
    'Report export contains no original raw URL field; other components can still contain sensitive values.',
  ],
};

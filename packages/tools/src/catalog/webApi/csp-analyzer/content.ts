import type { ToolContent } from '@devtoolora/core';

export const content: ToolContent = {
  documentation: [
    {
      content: [
        'Content-Security-Policy is a response header that tells the browser which sources a page may load scripts, styles, images, frames and other resources from. A strict policy limits the damage of cross-site scripting, clickjacking and injected plugin content.',
        'This tool reads a policy in four shapes: a bare value, a Content-Security-Policy or Content-Security-Policy-Report-Only header line, a meta tag, or one directive per line. It lowercases directive names and keywords, drops duplicate directives and rewrites the policy as one clean value.',
        'It then checks the result: unsafe-inline and unsafe-eval in script-src, script-src-elem and script-src-attr, wildcard and scheme-only sources (which strict-dynamic makes browsers ignore), a strict-dynamic without nonce or hash, and missing object-src, base-uri, frame-ancestors or form-action.',
      ],
      title: 'What is a CSP builder and analyzer?',
    },
    {
      content: [
        'Paste a header copied from DevTools to see which directives are risky before you ship it.',
        'Write one directive per line while drafting a policy, then pick Header or Meta tag to get a single line for your server config or HTML head.',
        'Compare a report-only rollout with the enforced policy. Use HTTP Headers Parser for a whole response and Meta Tag Generator for the rest of the head.',
      ],
      title: 'When to use CSP Builder & Analyzer',
    },
  ],
  examples: [
    "default-src 'self'; script-src 'self' 'nonce-abc' 'strict-dynamic'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self' → 6 directives, no findings.",
    "default-src 'self' 'unsafe-inline' 'unsafe-eval' https: → high findings for unsafe-inline, unsafe-eval and https:.",
    "Content-Security-Policy: default-src 'self'; object-src 'none'; base-uri 'self' → header line accepted as is.",
    "default-src 'self' on one line and object-src 'none' on the next → joined with semicolons.",
    "Content-Security-Policy-Report-Only: default-src 'self'; report-uri /csp-reports → info for report-only, low for deprecated report-uri.",
    'Meta tag output → a meta element with double quotes written as &quot;, plus a note on directives meta ignores.',
  ],
  faq: [
    {
      answer:
        "CSP3 browsers ignore 'unsafe-inline' when a nonce or hash is present, so it only helps old browsers. Without a nonce or hash it lets any injected inline script run, which is why it is high.",
      question: "Why is 'unsafe-inline' sometimes only info?",
    },
    {
      answer:
        "Without object-src or default-src, plugin content such as embed and object elements can load from anywhere. Set object-src 'none' unless you really need plugins.",
      question: 'Why is a missing object-src high?',
    },
    {
      answer:
        'Browsers ignore frame-ancestors, report-uri, report-to and sandbox in a meta policy. The meta output lists them in a comment; send them as an HTTP header instead.',
      question: 'Which directives does a meta tag not support?',
    },
    {
      answer:
        'The frame-ancestors, form-action, base-uri and object-src checks are skipped because a report-only policy blocks nothing and is often a partial draft. Other checks still run.',
      question: 'Why are presence checks skipped for report-only?',
    },
  ],
  help: 'Paste a policy value, a header line, a meta tag or one directive per line.\n\nChoose Report for the normalized policy, a directive table and findings, Header for one header line, or Meta tag for an HTML element.\n\nFindings are sorted from high to info; the summary counts them per level.\n\nCopy or download the result. Nothing is fetched and the policy is never enforced here.',
  notes: [
    'Input is at most 65,536 characters, 100 directives and 500 sources per directive.',
    "Directive names and keyword sources such as 'self' are lowercased; host sources keep their case. A duplicate directive keeps the first and is reported as medium.",
    'The effective script list is script-src, else default-src; the object list is object-src, else default-src. Wildcard, https:, http: and data: in those lists are high.',
    'Unknown and malformed directives are medium; deprecated directives such as plugin-types, referrer and report-uri are low.',
    'A report-only header gets an info finding and skips the object-src, base-uri, frame-ancestors and form-action checks.',
    'There is no hash computation, nonce generation or policy diff, and no page is fetched. Reading a policy does not prove a page works under it.',
  ],
};

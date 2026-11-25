import type { ToolContent } from '@devtoolora/core';

export const content: ToolContent = {
  documentation: [
    {
      content: [
        'robots.txt is a plain text file at the root of a site that tells crawlers which paths they may fetch. It is made of groups: one or more User-agent lines followed by Allow and Disallow rules, plus optional Crawl-delay and Sitemap lines. RFC 9309 defines how crawlers read it.',
        'A crawler uses the group whose User-agent token matches its own name, ignoring case, and falls back to the * group when none does. Inside that group the rule with the longest matching pattern wins; when an Allow and a Disallow match with the same length, Allow wins. A path that no rule matches is allowed.',
        'Patterns match from the start of the path. * matches any run of characters and a trailing $ anchors the pattern to the end of the path. Percent-encoded characters are compared decoded, except %2F, which stays encoded.',
      ],
      title: 'What is robots.txt?',
    },
    {
      content: [
        'Test mode checks a pasted robots.txt against a crawler name and a list of paths or full URLs, and reports for each path whether it is allowed and which rule decided it.',
        'Generate mode writes a clean file from a user agent, Allow and Disallow paths, a crawl delay and sitemap URLs, validating every line before it writes anything.',
        'Use it before deploying a change to confirm that a rule blocks only what you meant to block. Use URL Parse to split a URL, Meta Tag Generator for page-level robots directives and HTTP Status for response codes.',
      ],
      title: 'When to use robots.txt Generator & Tester',
    },
  ],
  examples: [
    'Disallow: /private/ with Allow: /private/public/ → /private/public/y is allowed because the Allow pattern is longer.',
    'Disallow: /*.pdf$ → /a/b.pdf is blocked, /a/b.pdfx is allowed.',
    'Disallow: /a and Allow: /a → /a is allowed because a tie goes to Allow.',
    'Googlebot tested against a file that only has a * group → the * group is used.',
    'https://example.com/admin/page?x=1 as a path → tested as /admin/page?x=1.',
    'Generate with Disallow /admin/ and /tmp/ → User-agent: *, Disallow: /admin/, Disallow: /tmp/.',
  ],
  faq: [
    {
      answer:
        'No. Matching is by product token: googlebot matches a Googlebot group but not Googlebot-Image. When no group matches the token, the * group is used.',
      question: 'Does a Googlebot group apply to Googlebot-Image?',
    },
    {
      answer:
        'The rule with the longest pattern wins, counted in characters. If an Allow and a Disallow have the same length, the Allow wins, which is the least restrictive choice RFC 9309 asks for.',
      question: 'Which rule wins when several match?',
    },
    {
      answer:
        'An empty Disallow value blocks nothing, so it is treated as no rule. Generate mode writes it only when you give no Allow or Disallow paths, to make an allow-everything file.',
      question: 'What does an empty Disallow mean?',
    },
    {
      answer:
        'No. robots.txt is a request to well-behaved crawlers, not access control. Anything sensitive needs authentication, and a listed path can even reveal that it exists.',
      question: 'Does robots.txt hide a page?',
    },
  ],
  help: 'Choose Test to check a robots.txt or Generate to write one.\n\nIn Test mode paste the file, enter the crawler name and list one path or full URL per line.\n\nIn Generate mode fill in the user agent, Allow and Disallow paths, sitemap URLs and an optional crawl delay; each path must start with / and each sitemap must be an absolute http(s) URL.\n\nCopy or download the result. Warnings about malformed lines are listed under # Warnings.',
  notes: [
    'Input is at most 500,000 characters and 1,000 test paths. Generate mode needs no pasted text and writes at most 1,000 Allow and Disallow lines.',
    'A leading byte order mark is ignored, field names are case-insensitive and # starts a comment.',
    'Groups with the same User-agent token are merged before rules are compared. Sitemap and unknown lines do not end a run of User-agent lines, and /robots.txt itself is always allowed (RFC 9309).',
    'Paths that do not start with / get one prepended; a full URL is reduced to its path and query string.',
    'Patterns support * and a trailing $ only; no other regular expression syntax is interpreted.',
    'Crawl-delay is written and kept in the parsed file, but it is not part of RFC 9309 and Google ignores it.',
    'The tester never fetches a robots.txt, never follows redirects and does not apply the 500 KiB crawler size cut-off or any HTTP status handling.',
  ],
};

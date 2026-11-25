import type { ToolContent } from '@devtoolora/core';

export const content: ToolContent = {
  documentation: [
    {
      content: [
        'Security headers are HTTP response headers that tell the browser to apply protections: force HTTPS, restrict where scripts load from, stop MIME sniffing, block framing and limit what the Referer header leaks.',
        'This tool reads a pasted response header block, optionally with a status line, and checks six graded headers: Strict-Transport-Security, Content-Security-Policy, X-Content-Type-Options, framing (CSP frame-ancestors or X-Frame-Options), Referrer-Policy and Permissions-Policy.',
        'It also reports other checks that do not affect the grade: Cross-Origin policies, the deprecated X-XSS-Protection, version numbers in Server and X-Powered-By, Set-Cookie flags and Cache-Control next to cookies.',
      ],
      title: 'What is a security headers analyzer?',
    },
    {
      content: [
        'Paste the headers from curl -I or the DevTools Network tab to see what a site is missing before a security review.',
        'Compare a staging response with production, or check that a proxy or CDN did not strip a header you set in the application.',
        'Use CSP Builder & Analyzer for a deeper look at the policy, Cookie Parser for single cookies and HTTP Headers Parser for the plain header list.',
      ],
      title: 'When to use Security Headers Analyzer',
    },
  ],
  examples: [
    'A response with HSTS (one year, includeSubDomains), a strict CSP, nosniff, a referrer policy and a permissions policy → grade A+.',
    'HTTP/1.1 200 OK with content-type and server: Apache only → grade F.',
    "content-security-policy: default-src 'self' 'unsafe-inline' → warn naming 'unsafe-inline'.",
    'strict-transport-security: max-age=300 → warn that max-age is below 31,536,000.',
    'set-cookie: sid=abc; SameSite=None → warn that SameSite=None requires Secure and that HttpOnly is missing.',
    'server: nginx/1.25.3 → warn that the value discloses a version number.',
  ],
  faq: [
    {
      answer:
        'A+ needs all six graded headers present with no warning anywhere in the report. A means six present, B five, C four, D three, E two and F fewer. A header with a warning still counts as present.',
      question: 'How is the grade calculated?',
    },
    {
      answer:
        'The framing check passes with a CSP frame-ancestors directive that names who may frame the page, or with X-Frame-Options set to DENY or SAMEORIGIN. It fails on frame-ancestors * or a bare scheme such as https:, because any site can then frame the page. A CSP without frame-ancestors does not count.',
      question: 'Do I need X-Frame-Options if I have frame-ancestors?',
    },
    {
      answer:
        'Browsers removed the XSS filter and it can create vulnerabilities in old versions. Send X-XSS-Protection: 0 or omit it and rely on a Content-Security-Policy.',
      question: 'Why is X-XSS-Protection a warning?',
    },
    {
      answer:
        'A report-only policy does not block anything, so it counts as missing for the grade. Use it to test a policy, then switch to the enforcing header.',
      question: 'Why does Content-Security-Policy-Report-Only fail?',
    },
  ],
  help: 'Paste a response header block, with or without the status line.\n\nChoose Report for the grade, a table of the six graded headers, other checks and cookie findings, or JSON for the same data as an object.\n\nFor repeated headers the first value is checked; every Set-Cookie line is checked.\n\nNothing is fetched. A request line such as GET / HTTP/1.1 is rejected because it holds no response headers.',
  notes: [
    'Input is at most 1,048,576 characters; a request block is rejected.',
    'The grade counts six headers: HSTS, CSP, X-Content-Type-Options, framing, Referrer-Policy and Permissions-Policy. A+ also needs no warning anywhere.',
    'HSTS fails when missing or max-age is 0, and warns below 31,536,000 seconds or without includeSubDomains. Keywords are matched case-insensitively.',
    'A CSP warns when the CSP analyzer finds a high finding; a report-only policy fails. Missing Permissions-Policy and Cross-Origin headers are info, not warnings.',
    'Set-Cookie lines add one warning for each high or medium cookie finding. Cache-Control gets an info when cookies are set without no-store or private.',
    'No site is requested, so the result reflects only the pasted text. Redirect chains, TLS settings and the HSTS preload list are not checked.',
  ],
};

import type { ToolContent } from '@devtoolora/core';

export const content: ToolContent = {
  documentation: [
    {
      content: [
        'A cookie is a name and value a server stores in the browser. A Set-Cookie response header creates it and can add attributes such as Path, Domain, Expires, Max-Age, Secure, HttpOnly, SameSite and Partitioned. The browser later returns only name=value pairs in a request Cookie header.',
        'The parser reads either form. A line with attributes becomes one Set-Cookie entry; a Cookie header becomes one entry per pair. Each entry reports its name, value, size in bytes, normalized attributes and findings such as SameSite=None without Secure or a broken __Host- prefix.',
        'The builder does the reverse: fill in the fields and it writes a Set-Cookie line with attributes in a fixed order, then runs the same checks on the result.',
      ],
      title: 'What is a cookie parser?',
    },
    {
      content: [
        'Check why a browser rejects or drops a cookie, for example a missing Secure flag or an oversized value. A missing Secure or HttpOnly is a medium finding, except on a cookie that is being deleted.',
        'Compare what the server sends in Set-Cookie with what the browser returns in Cookie.',
        'Produce a hardened Set-Cookie line for a session cookie, then paste it into server config. Use HTTP Headers Parser for whole header blocks and Secret Redactor before sharing a real session.',
      ],
      title: 'When to use Cookie Parser & Set-Cookie Builder',
    },
  ],
  examples: [
    'Set-Cookie: sid=abc123; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=3600 → one cookie, no findings.',
    'Cookie: theme=dark; lang=cs; sid=abc → three cookies, each without attributes.',
    '__Host-id=1; Path=/app; Secure → high finding: __Host- cookies require Path=/.',
    'tracker=1; SameSite=None → high finding: SameSite=None requires Secure.',
    'old=1; Expires=Wed, 21 Oct 2015 07:28:00 GMT → expired, an info finding says it deletes the cookie.',
    'Build with name sid, value abc, Secure, HttpOnly and Lax → Set-Cookie: sid=abc; Path=/; Secure; HttpOnly; SameSite=Lax.',
  ],
  faq: [
    {
      answer:
        'Browsers refuse a SameSite=None cookie that is not Secure, so the cookie is dropped in current Chrome, Edge and Firefox. Add Secure and serve the site over HTTPS.',
      question: 'Why is SameSite=None without Secure a high finding?',
    },
    {
      answer:
        'The __Host- prefix tells the browser to accept the cookie only if it is Secure, has Path=/ and has no Domain attribute. If any of these is missing the cookie is rejected, which is why the finding is high.',
      question: 'What do the __Host- and __Secure- prefixes require?',
    },
    {
      answer:
        'When both are present, Max-Age takes precedence and Expires is ignored. The parser reports this as an info finding so you can drop the redundant attribute.',
      question: 'What happens if a cookie has both Max-Age and Expires?',
    },
    {
      answer:
        'No. Values are shown exactly as pasted, including session identifiers. Everything runs locally, but run the text through Secret Redactor before you share the report.',
      question: 'Does it redact session cookies?',
    },
  ],
  help: 'Choose Parse to analyze pasted headers or Build to write a Set-Cookie line.\n\nIn Parse mode paste one cookie per line, with or without the Set-Cookie: or Cookie: prefix.\n\nIn Build mode enter a name and value, then the attributes you want; invalid names and values are rejected with a message.\n\nCopy or download the result. Cookie values are not redacted.',
  notes: [
    'Input is at most 65,536 characters and 1,000 cookies. Size is the bytes of name=value; over 4,096 bytes is flagged.',
    'A Set-Cookie: prefix makes a Set-Cookie line and a Cookie: prefix a request header. Without a prefix, a line is Set-Cookie only when every segment after the first pair is a known attribute (Domain, Path, Expires, Max-Age, Secure, HttpOnly, SameSite, Partitioned, Priority); otherwise each pair is its own request cookie.',
    'Request cookies are only checked for name and value problems because the browser does not send their attributes.',
    'Expires follows the RFC 6265 date algorithm in UTC, so IMF-fixdate, the RFC 850 dash form (two-digit years 00-69 mean 2000s) and asctime all work; the report shows ISO 8601. Text that fails it, such as 0 or -1, is ignored the way browsers ignore it: the cookie stays a session cookie and gets a medium finding. The builder also accepts ISO 8601.',
    'Quoted values and a quoted value containing = are kept as written; a leading dot in Domain is removed and flagged.',
    'The builder writes Domain, Path, Expires, Max-Age, Secure, HttpOnly, SameSite and Partitioned in that order and rejects invalid names or values.',
    'No cookie jar is simulated, and no network request is made. Parsing does not check domain matching, public suffixes or browser-specific limits.',
  ],
};

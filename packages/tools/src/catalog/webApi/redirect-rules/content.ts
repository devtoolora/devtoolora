import type { ToolContent } from '@devtoolora/core';

export const content: ToolContent = {
  documentation: [
    {
      content: [
        'A redirect tells a browser or crawler that a URL has moved. Every server has its own syntax for it: nginx uses location blocks with return, Apache uses Redirect and RedirectMatch in .htaccess, Netlify and Cloudflare Pages read a _redirects file, and Vercel reads a redirects array in vercel.json.',
        'The status code carries the meaning. 301 and 308 are permanent moves that search engines transfer ranking to, while 302 and 307 are temporary. 307 and 308 also keep the request method, which matters for POST requests.',
        'A wildcard rule matches a whole section of a site. A from ending in /* captures the rest of the path, and the target refers to it with :splat, which the tool writes as $1 for nginx and Apache and as :path* for Vercel.',
      ],
      title: 'What are redirect rules?',
    },
    {
      content: [
        'Write one rule per line as from to [status], separated by spaces, tabs, a comma, -> or →. The from is a path starting with /, optionally ending in /*; the to is a path or an absolute http or https URL. Without a status the Default status field applies.',
        "The tool reports a from that redirects to itself as a high finding, a duplicate from as medium (the first rule wins), a loop of any length and a wildcard that matches its own target as high, a chain where one target is another rule's from as low, a $ in a target as medium, and a status that differs from the default as info.",
        'Use it when moving a site or restructuring URLs, then paste the output into the server config. Use URL Parse to inspect an address, HTTP Status Codes to compare codes and robots.txt Generator & Tester to keep crawlers off retired paths.',
      ],
      title: 'When to use Redirect Rule Generator',
    },
  ],
  examples: [
    '/old /new → RedirectMatch 301 ^/old$ /new on Apache, /old /new 301 on Netlify.',
    '/blog/* /articles/:splat 302 → location ~ ^/blog/(.*)$ { return 302 /articles/$1; } on nginx.',
    '/gone -> https://other.example/x 308 → permanent: true in vercel.json.',
    '/docs/* /help/$1 → $1 is read as :splat and written for each target.',
    '/a /b and /b /c → a chain finding suggesting /a /c.',
    '/a /a → a high finding for a redirect loop.',
  ],
  faq: [
    {
      answer:
        'Use 301 or 308 when the move is permanent so search engines pass ranking to the new URL. Use 302 or 307 for a temporary move. Prefer 307 and 308 when the request method, such as POST, must be preserved.',
      question: 'Which status code should I use?',
    },
    {
      answer:
        'Each hop costs a request and may lose a little ranking. Pointing the first URL straight at the final target is faster and cleaner, which is what the chain finding suggests.',
      question: 'Why are redirect chains flagged?',
    },
    {
      answer:
        'Query strings, hosts and regular expressions are not supported. A from may only be a path, optionally ending in /*, which keeps the output identical in meaning across all four servers.',
      question: 'Can I match query strings or regular expressions?',
    },
    {
      answer:
        'Vercel turns permanent: true into 308 and permanent: false into 307, so those two are written that way. Other codes use statusCode.',
      question: 'How does Vercel express the status?',
    },
  ],
  help: 'Choose the Target server and the Default status.\n\nEnter one rule per line as from to [status]. Use /* at the end of from and :splat in to for a wildcard.\n\nThe summary counts the rules and findings such as loops, duplicates and chains.\n\nCopy or download the generated file. Blank lines and lines starting with # are ignored.',
  notes: [
    'The input accepts at most 10,000 non-blank lines of at most 2,048 characters each.',
    'A from must start with / and may only use * as a trailing /*. Query strings and other regex characters are rejected with the line number.',
    'A to is a path or an absolute http(s) URL; :splat and $1 both stand for the wildcard part.',
    'A to that uses a wildcard needs a from ending in /*.',
    'Values containing semicolons, braces or double quotes are rejected so no extra syntax can reach the nginx or Apache output.',
    'Every target matches the path exactly, and /* at the end of from is the only prefix form.',
    'Chains are detected one hop deep, and later duplicates of a from are dropped.',
    'Nothing is sent anywhere; the rules are generated in the browser.',
  ],
};

import type { ToolContent } from '@devtoolora/core';

export const content: ToolContent = {
  documentation: [
    {
      content: [
        'A sitemap is an XML file that lists the URLs of a site so search engines can find them. The sitemaps.org protocol wraps every page in a url element inside a urlset root, with loc as the only required child and lastmod, changefreq and priority as optional hints.',
        'A site with more than 50,000 URLs, or a file larger than 50 MB, is split into several sitemaps that a sitemap index lists. The index uses a sitemapindex root with one sitemap element per file, each with a loc and an optional lastmod.',
        'Every loc must be an absolute http or https URL of at most 2,048 characters, with ampersands and other special characters escaped as XML entities. lastmod is a W3C datetime, either a plain date or a full date-time with a time zone.',
      ],
      title: 'What is a sitemap.xml?',
    },
    {
      content: [
        'Generate mode turns one URL per line into a sitemap. After the URL you may add lastmod, changefreq and priority, separated by spaces, tabs or commas. A relative path needs the Base URL field, and duplicate URLs are dropped and reported.',
        'Validate mode parses a sitemap or sitemap index and reports errors, such as a missing or relative loc, a bad lastmod, an unknown changefreq or a priority outside 0.0 to 1.0, followed by warnings such as duplicates, mixed hosts and dates in the future.',
        'Use it before submitting a sitemap to Search Console. Use robots.txt Generator & Tester to point crawlers at the file, XML Format to pretty print it and URL Parse to inspect a single address.',
      ],
      title: 'When to use sitemap.xml Generator & Validator',
    },
  ],
  examples: [
    'https://example.com/about 2026-10-01 monthly 0.8 → a url entry with lastmod, changefreq and priority.',
    '/blog?page=2&sort=new with Base URL https://example.com → https://example.com/blog?page=2&amp;sort=new in loc.',
    'https://example.com/,2026-10-01,daily,1.0 → commas work as separators.',
    'The same URL on two lines → one entry, plus an info finding.',
    'A loc of /relative in validate mode → Entry 1: loc "/relative" is not an absolute http(s) URL.',
    'A sitemapindex with two sitemap elements → kind sitemapindex, 2 entries.',
  ],
  faq: [
    {
      answer:
        'No. Google ignores both priority and changefreq and uses lastmod only when it is consistently accurate. They are kept because the protocol defines them and other crawlers may read them.',
      question: 'Do priority and changefreq affect ranking?',
    },
    {
      answer:
        'A sitemap file may hold at most 50,000 URLs and 50 MB uncompressed. Past that, split the URLs into several files and list them in a sitemap index.',
      question: 'How many URLs can one sitemap hold?',
    },
    {
      answer:
        'Only if the namespace is missing or different, which the validator reports as a warning. Some crawlers are lenient, but the sitemaps.org namespace http://www.sitemaps.org/schemas/sitemap/0.9 is part of the protocol.',
      question: 'Is the xmlns attribute required?',
    },
    {
      answer:
        'A sitemap should only list URLs on the host that serves it, so the validator warns when a loc uses a different host than the first entry.',
      question: 'Why does the validator warn about a different host?',
    },
  ],
  help: 'Choose Generate to write a sitemap or Validate to check one.\n\nIn Generate mode enter one URL per line, optionally followed by lastmod, changefreq and priority. Fill in the Base URL when a line is a relative path.\n\nIn Validate mode paste a sitemap or sitemap index. Errors and warnings are listed with their entry numbers.\n\nCopy or download the result. Lines starting with # and blank lines are ignored in Generate mode.',
  notes: [
    'Generate mode accepts at most 50,000 URLs, 5,000,000 characters and 2,048 characters per loc. Validate mode accepts at most 50,000 entries, 1,000,000 XML nodes and 5,000,000 characters.',
    'Each loc is at most 2,048 characters and must be an absolute http or https URL.',
    'lastmod accepts YYYY, YYYY-MM, YYYY-MM-DD or a date-time with a time zone such as 2026-10-01T10:00:00+02:00.',
    'changefreq is one of always, hourly, daily, weekly, monthly, yearly or never; priority is 0.0 to 1.0.',
    'Element names are compared without their namespace prefix and are case-sensitive.',
    'The validator never fetches the listed URLs, so it cannot tell whether they exist or are blocked by robots.txt.',
    'DOCTYPE declarations are rejected and external entities are never loaded.',
  ],
};

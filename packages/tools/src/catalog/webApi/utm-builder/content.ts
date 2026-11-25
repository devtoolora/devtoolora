import type { ToolContent } from '@devtoolora/core';

export const content: ToolContent = {
  documentation: [
    {
      content: [
        'UTM parameters are query-string tags that analytics tools read to attribute a visit: utm_source names the sender, utm_medium the channel, utm_campaign the initiative, plus the optional utm_term, utm_content and utm_id.',
        'This tool appends them to a destination URL and keeps everything else: the path, other query parameters and the hash. If the link already has a utm_ parameter you fill in, it is replaced rather than duplicated.',
        'Values are trimmed, empty optional fields are skipped and spaces are encoded as "+". By default values are lowercased, because analytics reports treat Email and email as two different rows.',
      ],
      title: 'What is a UTM link builder?',
    },
    {
      content: [
        'Use it before you publish a newsletter, an ad, a social post or a partner link, so every campaign link follows the same naming.',
        'Fill in at least the source; medium and campaign are strongly recommended and produce a low finding when they are missing.',
        'Check the final link with URL Parser, and use Query String Parser to read the parameters of links you already have.',
      ],
      title: 'When to use UTM Link Builder',
    },
  ],
  examples: [
    'https://example.com/ with source newsletter, medium email, campaign Spring Sale → ?utm_source=newsletter&utm_medium=email&utm_campaign=spring+sale.',
    'Paid search with term running shoes → utm_term=running+shoes next to source google and medium cpc.',
    'Social post with content hero-banner → utm_content separates two creatives of the same campaign.',
    'A link that already has utm_source=old → the old value is replaced and an info finding says so.',
    'Lowercase off with source Newsletter → the case is kept and a low finding warns that analytics is case-sensitive.',
    'Campaign ID cmp-42 with source partner → utm_id=cmp-42 for tools that join on a campaign ID.',
  ],
  faq: [
    {
      answer:
        'Analytics tools group by the exact text, so Email and email become separate rows. Lowercase is on by default; turn it off only when your reports already rely on mixed case.',
      question: 'Why are values lowercased?',
    },
    {
      answer:
        'Only the destination URL and the source are required. Medium and campaign are recommended, because Google Analytics uses them with the source to classify a visit. Term and content are optional and only matter for paid keywords and for telling creatives apart.',
      question: 'Which parameters are required?',
    },
    {
      answer:
        'The tool rebuilds the link with the URL parser, so the query string uses "+" for spaces. Both "+" and %20 are read as a space by analytics tools.',
      question: 'Why does the link show + instead of %20?',
    },
    {
      answer:
        'Yes. Non-UTM query parameters and the hash stay as they were; only the utm_ parameters you fill in are added or replaced.',
      question: 'Are existing query parameters and the hash kept?',
    },
  ],
  help: 'Enter the destination URL and at least the source. Add medium, campaign, term, content or a campaign ID as needed.\n\nLeave Lowercase values ticked to keep naming consistent, or untick it to keep your exact case.\n\nThe result starts with the finished link, followed by one line per parameter and a list of findings such as missing recommended parameters or replaced values.\n\nCopy or download the link. Nothing is sent anywhere and the link is not visited.',
  notes: [
    'The URL is at most 8,192 characters and each parameter value at most 500 characters. The URL must be an absolute http or https address.',
    'Source is required. Medium and campaign are recommended and reported as low findings when empty.',
    'Values are trimmed and empty optional parameters are left out of the link.',
    'Existing utm_ parameters that you fill in are replaced; other query parameters and the hash are preserved.',
    'Spaces are encoded as "+", which analytics tools read as a space.',
    'The tool builds a link only; it does not check that the page exists or that your analytics property is configured.',
  ],
};

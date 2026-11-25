import type { ToolContent } from '@devtoolora/core';

export const content: ToolContent = {
  documentation: [
    {
      content:
        'Meta tags in a page’s <head> describe it to machines. Search engines read <title> and the description meta tag for result snippets, and rel="canonical" names the preferred address.\n\nOpen Graph (og:*) tags control link previews in Facebook, LinkedIn, Slack, Discord, WhatsApp, iMessage and many other apps: title, description, image and site name. X (Twitter) reads its own twitter:card tag and falls back to Open Graph for the rest.\n\nThe generator writes both sets, escapes the text for HTML, previews a search result and a link card, and suggests fixes for text that platforms usually cut off.',
      title: 'What are meta tags and Open Graph?',
    },
    {
      content: [
        'Add search and sharing tags to a new landing page, blog post or documentation site.',
        'Find out why a shared link shows the wrong title or no image, and rebuild the tags.',
        'Draft titles and descriptions against the preview before you publish.',
      ],
      title: 'When to generate meta tags',
    },
  ],
  examples: [
    'Title and description → <title>, the description meta tag, og:title, og:description and twitter:card.',
    'Image https://example.com/og.png → og:image and a large-image card; alt text adds og:image:alt and twitter:image:alt.',
    'Image /og.png with page URL https://example.com/blog/post → resolved to https://example.com/og.png.',
    'A 72-character title → a suggestion that search results usually cut titles after about 60 characters.',
    'Robots noindex, follow → <meta name="robots" content="noindex, follow">; the default index, follow writes no tag.',
    'X account example → twitter:site @example.',
    'Title Q&A <live> → content="Q&amp;A &lt;live&gt;".',
  ],
  faq: [
    {
      answer:
        '1200×630 pixels, about 1.91:1, suits large link cards on Facebook, LinkedIn and X. Keep important text away from the edges, because some apps crop the image to a square or a narrower ratio.',
      question: 'What size should an og:image be?',
    },
    {
      answer:
        'The generator cannot see your live page, so first confirm the new tags are in the served HTML with View Source. Then make each platform scrape again, because they cache previews; Facebook and LinkedIn have debugger pages for that.',
      question: 'Why does my shared link still show the old title or image?',
    },
    {
      answer:
        'No. X reads og:title, og:description and og:image when its own tags are missing, so the generator writes only twitter:card, plus twitter:site and twitter:image:alt when you fill them in.',
      question: 'Do I need twitter:title and twitter:description tags?',
    },
    {
      answer:
        'Keep titles to about 60 characters and descriptions to about 160; the summary suggests changes above those limits and below 10 and 50. Search engines cut by pixel width, so treat the counts as a guide.',
      question: 'How long should the title and description be?',
    },
    {
      answer:
        'No. The tags and preview are built only from what you type. The preview draws a placeholder box with the image URL instead of loading the image, so check the published page with each platform’s debugger.',
      question: 'Does the generator fetch my page or image?',
    },
  ],
  help: 'Enter the page title and description. The tags and preview update as you type.\n\nAdd the canonical page URL, site name, page type, image URL and image alt text. 1200×630 pixels suits large cards.\n\nCheck the preview and the suggestions in the summary, then shorten text that would be cut off.\n\nCopy the tags into the page <head> or save meta-tags.html. After publishing, refresh each platform’s cached preview with its link debugger.',
  notes: [
    'Generation is local. The preview is drawn from your text and does not fetch the page or the image.',
    'Character counts are guides: search engines truncate by pixel width and may rewrite descriptions.',
    'Open Graph needs absolute URLs, so a relative image path is resolved against the page URL.',
    'Platforms cache previews. After changing tags, re-scrape the page with the Facebook Sharing Debugger or LinkedIn Post Inspector, or share the link again.',
    'Facebook needs images of at least 200×200 pixels; large cards look best at 1200×630 (1.91:1). Add og:image:width and og:image:height by hand if you know them.',
    'Robots index, follow is the default and writes no tag. noindex removes a page from results only if crawlers can still fetch it.',
    'X card Auto uses summary_large_image when there is an image and summary when there is none.',
  ],
};

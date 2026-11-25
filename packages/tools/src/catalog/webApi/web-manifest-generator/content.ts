import type { ToolContent } from '@devtoolora/core';

export const content: ToolContent = {
  documentation: [
    {
      content: [
        'A web app manifest is a JSON file, usually named manifest.webmanifest, that tells the browser how your site behaves when it is installed: its name, start URL, display mode, colors and icons.',
        'This tool writes only the members you fill in, in a conventional order, and checks them against what browsers need for an install prompt: a 192x192 and a 512x512 PNG icon.',
        'Icons are entered one per line as "src [sizes] [type] [purpose]". When sizes or type are left out they are inferred from the file name, so /icons/icon-192.png becomes 192x192 and image/png.',
      ],
      title: 'What is a web app manifest?',
    },
    {
      content: [
        'Use it when you turn a site into a progressive web app, or when you want to review the manifest of an existing one before shipping.',
        'The summary says whether the app is installable and lists findings: a missing icon size, no maskable icon, a short name that may be truncated, a start URL outside the scope or an invalid language tag.',
        'Link the saved file from your pages with a link rel="manifest" tag. Meta Tag Generator and Web & PWA Icon Generator cover the tags and the icon files.',
      ],
      title: 'When to use Web App Manifest Generator',
    },
  ],
  examples: [
    'Name Dev Toolora with two PNG icons (192 and 512) → an installable manifest with no findings.',
    'Display minimal-ui with categories "productivity, utilities" → display and a lowercase categories array.',
    'A single /icon-192.png → sizes 192x192 inferred, a high finding that no 512x512 icon exists.',
    'Short name "Dev Toolora Dashboard" → a medium finding that it may be truncated.',
    'Display fullscreen with orientation landscape → a manifest for a game that locks the screen.',
    'Language ar with direction rtl → lang and dir members for a right-to-left app.',
  ],
  faq: [
    {
      answer:
        'Chromium browsers want a name, a start URL, a display mode other than browser and PNG icons of 192x192 and 512x512. This tool checks the icons and display mode and reports what is missing.',
      question: 'What makes an app installable?',
    },
    {
      answer:
        'A maskable icon has extra padding so Android can crop it to a circle or squircle. Without one, the system may shrink your icon onto a white background.',
      question: 'Why is a maskable icon recommended?',
    },
    {
      answer:
        'The default text direction auto is the browser default, so it is left out. Choose ltr or rtl to write the dir member.',
      question: 'Why is dir missing from the output?',
    },
    {
      answer:
        'No. The tool only builds the JSON from your input; it does not fetch the icon files or the start URL.',
      question: 'Does it check that the icons exist?',
    },
  ],
  help: 'Enter the app name and, if you like, a short name, start URL, scope, display mode, colors and categories.\n\nList icons one per line as "src [sizes] [type] [purpose]". Sizes and type are inferred from the file name when omitted.\n\nThe result is the manifest JSON, and the summary shows installability, the icon count and findings.\n\nCopy or download manifest.webmanifest. Nothing is sent anywhere.',
  notes: [
    'Each field is at most 2,000 characters and at most 50 icon lines are accepted.',
    'Only members with a value are written; empty fields are left out.',
    'Colors must be valid CSS colors and are written as typed.',
    'Installable means a 192x192 and a 512x512 icon with type image/png.',
    'Categories are comma-separated, trimmed and lowercased.',
    'The tool builds the manifest only; it does not fetch icons or validate that URLs resolve.',
  ],
};

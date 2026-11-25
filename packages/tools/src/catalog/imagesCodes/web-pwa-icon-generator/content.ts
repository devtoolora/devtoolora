import type { ToolContent } from '@devtoolora/core';

export const content: ToolContent = {
  documentation: [
    {
      content: [
        'This tool turns one image or a short text mark into the icon files a website or Progressive Web App needs, plus a site.webmanifest, packed as web-pwa-icons.zip.',
        'The ZIP holds favicon.ico (16, 32 and 48 px), favicon-16x16.png, favicon-32x32.png, favicon-48x48.png, apple-touch-icon.png (180 px), icon-192.png, icon-512.png, icon-512-maskable.png, site.webmanifest and a one-line README.md.',
      ],
      title: 'What is Web & PWA Icon Generator?',
    },
    {
      content: [
        'Start a new site or PWA and get a favicon, an iOS home screen icon and Android install icons in one step.',
        'Make a placeholder icon from initials or an emoji before the final logo exists.',
      ],
      title: 'When to use Web & PWA Icon Generator',
    },
  ],
  examples: [
    'Text mark SF, Icon background #2563eb → 10 files in web-pwa-icons.zip, each icon showing white SF on a blue rounded square.',
    'Border radius 96 → 96 px corners in icon-512.png and 36 px in icon-192.png; 0 gives square corners and 256 a circle.',
    'Text label ABCD → only ABC is drawn.',
    'App name My App → "name": "My App" and "short_name": "My App" in site.webmanifest.',
    'Theme color #2563eb → "theme_color": "#2563eb" in site.webmanifest.',
    'A 1024 × 512 logo → fitted into each square and centered, with transparent space above and below it in icon-192.png and icon-512.png.',
    'Background color #0f172a → apple-touch-icon.png and icon-512-maskable.png get a #0f172a background, and the maskable artwork sits inside 64 px of padding.',
    'favicon.ico → one file containing the 16, 32 and 48 px PNG images.',
  ],
  faq: [
    {
      answer:
        'Copy the files to your site’s root and add <link rel="icon" href="/favicon.ico">, <link rel="apple-touch-icon" href="/apple-touch-icon.png"> and <link rel="manifest" href="/site.webmanifest"> to the <head>. The ZIP has no HTML snippet of its own.',
      question: 'Which HTML tags do I need for these icons?',
    },
    {
      answer:
        'Android can crop install icons to a circle, squircle or other shape. icon-512-maskable.png fills the whole square with Background color and keeps your artwork inside 64 px of padding, so the mask does not cut it off.',
      question: 'What is a maskable icon?',
    },
    {
      answer:
        'A square image of at least 512 × 512 px, ideally a PNG with a transparent background. Smaller images are scaled up and look soft in icon-512.png, and non-square images are fitted with empty space on two sides.',
      question: 'What size should my source image be?',
    },
    {
      answer:
        'No. site.webmanifest only sets name, short_name, theme_color, background_color, display standalone and the three icons. Add start_url, scope and description yourself if your PWA needs them.',
      question: 'Does the manifest include start_url?',
    },
    {
      answer:
        'Yes. Choose Text mark and type an emoji such as 🚀 as Text label; it is drawn with your operating system’s emoji font. Only the first three characters of the label are used.',
      question: 'Can I use an emoji or initials as the icon?',
    },
    {
      answer:
        'No. The icons are resized with the browser’s canvas, the ICO and ZIP files are assembled in the tool, and nothing is sent over the network.',
      question: 'Is my logo uploaded?',
    },
  ],
  help: 'Choose Source: Image file to upload a logo, or Text mark to draw up to three characters.\n\nFor an image, choose a square PNG of at least 512 × 512 px; for a text mark, set Text label, Text color, Icon background and Border radius.\n\nEnter App name, Theme color and Background color for site.webmanifest; Background color also fills the Apple touch icon and the maskable icon.\n\nRun the tool, download web-pwa-icons.zip, copy the files to your site’s root folder and link them from your HTML.',
  notes: [
    'SVG sources cannot be decoded here; convert the file with SVG to PNG first.',
    'All icons are drawn and zipped on your device; the source image is not uploaded.',
    'Images are scaled to fit and centered, never cropped. Non-square images get transparent padding, except in the Apple touch icon and the maskable icon, which are filled with Background color.',
    'icon-512-maskable.png is listed with "purpose": "maskable" and keeps the artwork in the central 384 × 384 px.',
    'Text marks use the system’s bold sans-serif font at 42% of the icon size, so letters can look slightly different on each operating system.',
    'Border radius is a whole number from 0 to 256, measured on the 512 px icon and scaled with each size; the maskable icon scales it to its 384 px safe area.',
    'If Source is Image file, a Source image is required; without one the tool asks for it instead of drawing the text mark.',
  ],
};

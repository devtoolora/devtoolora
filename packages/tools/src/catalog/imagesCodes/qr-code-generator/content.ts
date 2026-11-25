import type { ToolContent } from '@devtoolora/core';

export const content: ToolContent = {
  documentation: [
    {
      content: [
        'QR Code Generator encodes text, a URL or another payload as a QR code and returns crisp SVG markup and a qr-code.svg download.',
        'You choose the size in pixels, the quiet-zone margin, the foreground and background colors and one of four error correction levels.',
      ],
      title: 'What is QR Code Generator?',
    },
    {
      content: [
        'Put a link on a poster, slide, package or business card, or encode a mailto:, tel: or WIFI: string.',
        'Create test codes for scanner apps without sending the data to an online generator.',
      ],
      title: 'When to use QR Code Generator',
    },
  ],
  examples: [
    'https://example.com with the defaults → a 256 × 256 px SVG with viewBox="0 0 33 33": 25 modules plus a 4-module margin on each side.',
    'https://example.com with Margin 0 → viewBox="0 0 25 25", with no quiet zone.',
    'https://example.com at Low → version 2 (25 × 25 modules); at High → version 3 (29 × 29 modules).',
    'Foreground #1d4ed8, Background #f8fafc → <path stroke="#1d4ed8" …> modules on a <path fill="#f8fafc" …> square.',
    'Foreground navy, Background rgb(255 251 235) → stroke="#000080" and fill="#fffbeb", because colors are written as hex.',
    'Foreground reddish → error: Foreground must be a CSS color, such as #1d4ed8, rgb(29 78 216) or navy.',
    'Size 32 → error: Size must be an integer between 64 and 2048.',
    '3,000 characters of text → error: The amount of data is too big to be stored in a QR Code.',
  ],
  faq: [
    {
      answer:
        'Up to 2,953 bytes of text at Low error correction, or 7,089 characters if the text is only digits. At High the limit drops to 1,273 bytes. Longer input fails with “The amount of data is too big to be stored in a QR Code”.',
      question: 'How much data can a QR code hold?',
    },
    {
      answer:
        'Medium, the default, restores about 15% of damaged modules and suits screens and clean prints. Use Quartile (25%) or High (30%) for small prints, rough surfaces or a logo on top, and Low (7%) for the least dense code with long text.',
      question: 'Which error correction level should I choose?',
    },
    {
      answer:
        'No. The text is stored in the code itself, so it works as long as the link or data inside stays valid, and no redirect service counts the scans.',
      question: 'Do these QR codes expire or track scans?',
    },
    {
      answer:
        'This tool exports SVG only. Run the SVG through SVG to PNG and enter a Max width such as 1024 to get a sharp PNG at that size.',
      question: 'Can I download the QR code as PNG?',
    },
    {
      answer:
        'Any CSS color: hex such as #000, #1d4ed8 or #00000080, rgb(), hsl(), oklch() and names like navy. The SVG stores the color as hex, so navy becomes #000080, and a value that is not a color is refused with an error.',
      question: 'Which color formats can I use for Foreground and Background?',
    },
    {
      answer:
        'Margin is the quiet zone of empty modules around the code, from 0 to 16 and 4 by default. Scanners use it to find the code, so keep 4 unless the code already sits on a plain light area.',
      question: 'What does the Margin field do?',
    },
  ],
  help: 'Type or paste the text or URL to encode; spaces at the start and end are removed.\n\nSet Size in pixels (64–2048) and Margin in modules (0–16); keep a margin of about 4 for reliable scanning.\n\nChoose Error correction and enter Foreground and Background as CSS colors, such as #111827, rgb(17 24 39) or navy.\n\nRun the generator, scan the preview with a phone, then copy the SVG or download qr-code.svg.',
  notes: [
    'Codes are generated locally with the qrcode library; the text is not sent to a server and no redirect link is added.',
    'Size sets the width and height of the SVG; the viewBox counts modules, so the code stays sharp at any display size.',
    'Text outside ASCII, such as č or emoji, is encoded as UTF-8 bytes, which current scanner apps decode correctly.',
    'Dark modules on a light background scan most reliably; light-on-dark codes are not read by every scanner.',
    'Only SVG export is available in this tool.',
  ],
};

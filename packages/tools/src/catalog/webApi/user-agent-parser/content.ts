import type { ToolContent } from '@devtoolora/core';

export const content: ToolContent = {
  documentation: [
    {
      content:
        'Browsers and HTTP clients send a User-Agent header that describes them, such as Mozilla/5.0 (iPhone; CPU iPhone OS 17_4_1 like Mac OS X) … Safari/604.1. The format is historical: nearly every browser starts with Mozilla/5.0 and mentions engines it is not.\n\nThe parser reads the browser and version, the rendering engine, the operating system and version and the device type, and recognizes common crawlers and command-line clients.\n\nOrder matters. Edge, Opera, Samsung Internet and Chrome on iOS also contain Chrome or Safari tokens, so the most specific token wins.',
      title: 'What is a User-Agent string?',
    },
    {
      content: [
        'Explain browser and OS breakdowns in server logs or analytics exports.',
        'Reproduce a bug report by finding which browser version and platform sent a request.',
        'Recognize crawlers and tools such as Googlebot, curl and Postman in access logs.',
      ],
      title: 'When to parse a user agent',
    },
  ],
  examples: [
    'Chrome/124 on Mac OS X 10_15_7 → Chrome 124.0.0.0, Blink, macOS 10.15.7, desktop.',
    'Edg/124 next to Chrome/124 → Edge, because the Edg token is more specific.',
    'CriOS/124 on iPhone → Chrome on iOS with the WebKit engine, which Apple requires for iOS browsers.',
    'Windows NT 10.0 → Windows 10 or 11; the string cannot tell them apart.',
    'Android without the Mobile token → tablet.',
    'Googlebot/2.1 → device bot.',
  ],
  faq: [
    {
      answer:
        'No. Any client can send any User-Agent, so the result is a pattern-based guess. Confirm real crawlers another way, for example with the reverse DNS check Google documents for Googlebot.',
      question: 'Can I trust the User-Agent to identify a browser or bot?',
    },
    {
      answer:
        'For compatibility: browsers copied the tokens of older browsers so that sites would not block them. That is why the parser checks the most specific token first, such as Edg/ before Chrome/ and Chrome/ before Safari.',
      question: 'Why does Chrome’s User-Agent mention Mozilla and Safari?',
    },
    {
      answer:
        'Windows 11 browsers still send Windows NT 10.0, so the string alone cannot tell the two apart and osVersion says 10 or 11. Read the Sec-CH-UA-Platform-Version client hint when you need the exact version.',
      question: 'Why does Windows 11 show as Windows 10 or 11?',
    },
    {
      answer:
        'Googlebot, Bingbot, DuckDuckBot, YandexBot, Baiduspider, Facebook’s link preview, Twitterbot, Slackbot, curl, Wget, python-requests and Postman, each reported with device bot. Other crawlers, such as GPTBot, are parsed like an ordinary client.',
      question: 'Which bots and tools does it recognize?',
    },
    {
      answer:
        'No. It reports only a device type: desktop, mobile, tablet or bot. Model codes such as SM-X710 are not looked up, and Chromium’s reduced User-Agent replaces the model with K anyway.',
      question: 'Does it detect the device model?',
    },
  ],
  help: 'Paste a User-Agent header value, for example from server logs, the DevTools Network panel or navigator.userAgent. The result updates as you type.\n\nRead the browser, engine, operating system and device type.\n\nWhen exact versions matter, compare with Sec-CH-UA client hints, because modern browsers freeze parts of the string.\n\nCopy the JSON or save user-agent.json.',
  notes: [
    'Parsing is local and pattern based. It is a best guess, not identity or security information: any client can send any string.',
    'Chromium browsers freeze the operating system version and device model (User-Agent reduction): macOS is always reported as 10.15.7 and Android devices as K. Use Sec-CH-UA client hints for exact values.',
    'Windows 11 still sends Windows NT 10.0.',
    'iPadOS in desktop mode sends a Macintosh string, so it is reported as macOS on a desktop.',
    'Unknown or custom clients are reported as Unknown rather than guessed.',
    'Input is limited to 4,096 characters.',
  ],
};

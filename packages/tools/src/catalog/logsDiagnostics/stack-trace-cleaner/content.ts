import type { ToolContent } from '@devtoolora/core';

export const content: ToolContent = {
  documentation: [
    {
      content: [
        'A stack trace lists execution frames associated with an exception. This tool extracts common at-style JavaScript/TypeScript frames, with or without a function name, and File-style Python frames.',
        'It retains recognized source order, removes blank lines and consecutive duplicate frames, and creates a concise Markdown report.',
        'For Python-only input it uses the last non-frame line as the exception; otherwise it uses the first. Mixed exception chains and source-code lines are not fully reconstructed.',
      ],
      title: 'What is stack trace cleaning?',
    },
    {
      content: [
        'Prepare a short trace for a bug report.',
        'Remove immediately repeated frames without reordering the call sequence.',
        'Keep the original trace for source context, source-map resolution and detailed debugging.',
      ],
      title: 'When to use Stack Trace Cleaner',
    },
  ],
  examples: [
    'TypeError: demo and at parse (/app/a.ts:12:9) → Exception: TypeError: demo, Frames: 1.',
    'A traceback ending in ValueError: demo → Exception: ValueError: demo with its File "app.py", line 10, in run frame.',
    'at run (/app/a.ts:1:2) twice in a row → one frame.',
    'Frames a, b, a → three frames; only adjacent repeats collapse.',
    'Mixed JavaScript and Python frames → listed in their original input order.',
    'INFO started → an error: no supported stack frames found.',
    'at /app/server.js:10:5 without a function name → kept as a frame.',
  ],
  faq: [
    {
      answer:
        'JavaScript and TypeScript at frames with or without a function name, such as at parse (/app/a.ts:12:9) and at /app/server.js:10:5, V8 built-in frames such as at Array.map (<anonymous>) and at Promise.all (index 0), Python File "…", line N frames, and Java at frames that name a file and line. Firefox or Safari name@url frames and .NET frames are not recognized.',
      question: 'Which stack trace formats are supported?',
    },
    {
      answer:
        'Only consecutive duplicates. Identical lines next to each other collapse to one, but a frame that reappears after a different frame stays, so recursion patterns remain visible.',
      question: 'Does it remove duplicate frames?',
    },
    {
      answer:
        'For a Python traceback the last non-frame line, such as ValueError: bad, is used. Otherwise the first non-frame line, usually the JavaScript error message, is used.',
      question: 'How is the exception line chosen?',
    },
    {
      answer:
        "No. This tool keeps paths, line numbers and column numbers exactly as written. To map minified bundle locations back to the original sources, use Source Map Resolver with the bundle's .map files.",
      question: 'Does it resolve source maps?',
    },
    {
      answer:
        'No. Paths, function names and exception messages are copied as they are and can include user names or secrets. Run Raw Log Redactor and review the result before sharing.',
      question: 'Are file paths and error messages redacted?',
    },
  ],
  help: 'Paste the full trace or apply a sample.\n\nRun cleaning and review the chosen exception and ordered frames.\n\nCompare against the original before discarding context.\n\nCopy or download Markdown. Paths, function names and exception messages are not redacted.',
  notes: [
    'Input is limited to 1,048,576 UTF-16 characters. No network requests or execution of log contents occur.',
    'Reports and transformed logs may still contain names, paths, identifiers or personal data. Review before copying or sharing.',
    'Java at frames with a file and line, such as at com.example.App.run(App.java:42), are listed like JavaScript frames. Native Method and Unknown Source frames are skipped, and Caused by chains and ... N more lines are not reconstructed.',
    'Browser name@url frames, .NET and native traces and source-map resolution are unsupported.',
    'Consecutive duplicate removal does not mean globally unique frames.',
    'The report omits source-code context and may simplify chained exceptions.',
    'Paths and exception messages can contain sensitive values; use separate redaction and review.',
  ],
};

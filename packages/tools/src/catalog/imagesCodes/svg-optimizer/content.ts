import type { ToolContent } from '@devtoolora/core';

export const content: ToolContent = {
  documentation: [
    {
      content: [
        'Reduces SVG file size and eliminates redundant XML metadata, comments, editor namespaces and whitespace while strictly preserving viewboxes, element IDs, class names and accessibility tags.',
      ],
      title: 'What is SVG Optimizer?',
    },
    {
      content: [
        'Use when exporting vector graphics from Figma, Illustrator or Sketch before embedding them in web applications, inline React components, or CSS.',
      ],
      title: 'When to use SVG Optimizer',
    },
  ],
  examples: [
    '<!-- icon --><metadata>editor data</metadata> inside <svg> → both removed.',
    '<?xml version="1.0" encoding="UTF-8"?> and an Illustrator <!-- Generator: … --> comment before <svg> → both removed.',
    'inkscape:version="1.2" and xmlns:inkscape="…" → removed, and so are xmlns:sketch and sketch:type; xmlns:foo and foo:bar from other namespaces stay.',
    'viewBox="0 0 24.000 24.000" → viewBox="0 0 24 24", and stroke-width="1.500" → stroke-width="1.5".',
    '<text>Version 2.0</text> and id="icon-1.0" → copied unchanged, because only numeric attributes are trimmed.',
    '<path id="mark" class="icon" aria-label="Mark" d="M 2 2 L 22 22" /> → the same element with id, class and aria-label, closed as "/>".',
    'The Icon with editor metadata sample → one line of SVG and the summary SVG optimized: 195 to 149 bytes (24% smaller).',
    '<div><svg></svg></div> → error: Paste valid SVG markup starting with <svg>.',
  ],
  faq: [
    {
      answer:
        'The XML declaration, doctypes, comments, <metadata> blocks, Inkscape and Sodipodi attributes, whitespace between tags and trailing zeros in numeric attributes, such as 1.50 in d or stroke-width. Everything else, including text, <title>, <desc>, ids, classes and data- attributes, is kept.',
      question: 'What does the SVG optimizer remove?',
    },
    {
      answer:
        'The input must begin with <svg>, optionally after an XML declaration, comments or a doctype, such as the <?xml …?> and <!-- Generator: … --> header from Illustrator. Markup wrapped in another element, such as <div><svg>, is refused; copy only the <svg> element.',
      question: 'Why do I get “Paste valid SVG markup starting with <svg>”?',
    },
    {
      answer:
        'No. Text in <text>, <tspan>, <title>, <style> and other elements is copied unchanged, including runs of spaces and numbers such as 2.0. Whitespace between tags is removed only outside text elements, so the space between two <tspan>s stays.',
      question: 'Can the optimizer change visible text in my SVG?',
    },
    {
      answer:
        'It is a lighter cleanup: it does not merge paths, round coordinates, shorten colors or remove unused ids. Savings are largest for exported icons with comments, metadata and indentation, and small for files that are already minified.',
      question: 'How does this compare to SVGO?',
    },
    {
      answer:
        'No. The cleanup runs on your device, so the SVG never leaves it and the tool works offline.',
      question: 'Does SVG Optimizer upload my file?',
    },
  ],
  help: 'Paste raw SVG markup into the text area or run on active editor selection.\n\nRun the optimizer to parse and sanitize the vector document.\n\nReview the savings summary (UTF-8 bytes before and after).\n\nCopy clean SVG markup or download optimized.svg.',
  notes: [
    'Optimization runs locally, tag by tag, without a full XML parser. Text content, CDATA and the values of non-numeric attributes are copied unchanged.',
    'Trailing zeros are trimmed only in numeric attributes such as d, points, viewBox, x, width and stroke-width.',
    'Critical visual attributes (viewBox, width, height, fill, stroke, transform) are preserved.',
    'Classes and IDs are retained to prevent breaking external CSS styles or JavaScript hooks.',
    'Malformed XML is not detected: unclosed tags pass through unchanged. Only input that does not start with <svg>, optionally after an XML declaration, comments or a doctype, is refused.',
    'Does not perform destructive path approximation or lossy coordinate truncation.',
  ],
};

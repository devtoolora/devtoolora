import type { ToolContent } from '@devtoolora/core';

export const content: ToolContent = {
  documentation: [
    {
      content: [
        'A data URI puts a whole file inside a URL, so a small SVG icon can live in CSS or HTML without a separate request. The URL-encoded form percent-encodes only the characters that break a URL, such as #, % and <, and is usually smaller than Base64.',
        'The CSS output wraps the data URI in an .icon rule with background-image, background-repeat: no-repeat and background-size: contain.',
        'The JSX output turns the SVG into a React component. class becomes className, namespaced and hyphenated attributes become camelCase (xlinkHref, strokeWidth), data-* and aria-* stay as they are, and a style attribute becomes a style object. The root receives {...props} last, so callers can override any attribute.',
      ],
      title: 'What is an SVG data URI?',
    },
    {
      content: [
        'Inline icons in CSS without an extra HTTP request.',
        'Background images for buttons, list markers and form controls.',
        'Turning a designer export into a React icon component.',
        'Checking that an SVG from an unknown source has no script before you inline it.',
      ],
      title: 'When to convert SVG to a data URI, CSS or JSX',
    },
  ],
  examples: [
    '<svg …><path d="M5 12l5 5L20 7"/></svg> → data:image/svg+xml,%3Csvg …',
    'Output CSS → .icon { background-image: url("data:image/svg+xml,…"); … }',
    'Encoding Base64 → data:image/svg+xml;base64,PHN2Zy…',
    'class="a" stroke-width="2" → className="a" strokeWidth="2"',
    "style=\"stroke-width: 2; --x: 1\" → style={{ strokeWidth: '2', '--x': '1' }}",
    '<svg onload="…"> → rejected, the attribute onload can run script',
  ],
  faq: [
    {
      answer:
        'URL encoding keeps the SVG readable and is usually smaller. Use Base64 when a tool or pipeline expects it, or when the SVG has many non-ASCII characters.',
      question: 'Should I use URL encoding or Base64?',
    },
    {
      answer:
        'Inlined SVG runs in your page. A <script>, an iframe, frame, object or embed element, a srcdoc attribute, an on* event handler (also one set by an animation) or a javascript: URL could run code there, so the tool refuses to convert them.',
      question: 'Why is my SVG rejected?',
    },
    {
      answer:
        'Comments, and whitespace between elements outside text, which JSX would lose anyway. Text inside <text> and <tspan> keeps its spaces, and <style> content becomes a template literal.',
      question: 'What does the JSX output leave out?',
    },
    {
      answer:
        'It removes comments, metadata, editor attributes and extra whitespace, and trims trailing zeros in numbers. The summary shows how many bytes it saved. Turn it off to keep the source exactly.',
      question: 'What does Optimize first change?',
    },
    {
      answer:
        'Turn on TypeScript. The component then imports the SVGProps type from react and types its props as SVGProps<SVGSVGElement>.',
      question: 'Can I get a TypeScript component?',
    },
  ],
  help: 'Paste SVG markup and pick an Output: Data URI, CSS or JSX.\n\nFor a data URI or CSS, choose URL-encoded or Base64. For JSX, set the Component name and turn on TypeScript if you need types.\n\nOptimize first is on by default and reports the saved bytes.\n\nThe preview shows the SVG that was converted. SVG with script, event handler attributes or javascript: URLs is rejected.',
  notes: [
    'Input is at most 500,000 characters; the root element must be <svg>.',
    'DOCTYPE declarations are rejected, so external entities are never loaded.',
    'The component name must be PascalCase, such as Icon or ArrowLeft.',
    "Attribute values with a double quote print as {'…'} expressions.",
    "Braces and angle brackets in text print as {'{'} style expressions.",
    'Optimize drops Inkscape and Sodipodi editor elements; other elements JSX cannot express are rejected, never dropped.',
  ],
};

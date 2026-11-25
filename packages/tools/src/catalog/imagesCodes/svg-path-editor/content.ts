import type { ToolContent } from '@devtoolora/core';

export const content: ToolContent = {
  documentation: [
    {
      content: [
        'The d attribute of an SVG <path> is a small language: a command letter such as M (move), L (line), C (cubic curve), Q (quadratic curve), A (arc) or Z (close), followed by its numbers. Uppercase letters use absolute coordinates, lowercase letters are relative to the current point.',
        'This tool reads path data, a <path> element or an SVG document with one path, and rewrites it: one command per line, absolute or relative, minified, moved or scaled. It also measures the result and draws it with every end and control point.',
        'Everything runs in your browser. Nothing is uploaded.',
      ],
      title: 'What is the SVG Path Editor?',
    },
    {
      content: [
        'Format and Absolute make a path easy to read and diff. Relative and Minify make it short for inline icons and data URIs.',
        'Translate adds Offset x and Offset y to every point. Scale multiplies by Scale x and Scale y; a negative factor mirrors the path. When Scale x and Scale y differ, arcs cannot stay arcs, so each one becomes cubic Béziers of at most 90° and the summary says so.',
        'Precision rounds every number in the output, from 0 to 6 decimals. The box, length and points are measured on the rounded path, so they match what you copy.',
      ],
      title: 'When to use each operation',
    },
  ],
  examples: [
    'M0 0L10 10 with Relative → "m0 0\\nl10 10".',
    'm0 0l10 10 with Absolute → "M0 0\\nL10 10".',
    'M 0.50 0.50 L 1.00 0.00 with Minify → "M.5.5 1 0".',
    'M0 0L10 10 with Translate, Offset x 5 and Offset y 2 → "M5 2\\nL15 12".',
    'M0 0L10 20 → "2 commands · 2 segments · 1 subpath · 10×20 at 0,0 · length 22.361".',
    'An SVG with three <path> elements → "Found 3 <path> elements; paste one path or its d attribute."',
  ],
  faq: [
    {
      answer:
        'Yes. Paste a <path …/> element or a whole SVG document with exactly one <path>; its d attribute is used. Several paths are not supported, so copy the one you need.',
      question: 'Can I paste SVG markup instead of path data?',
    },
    {
      answer:
        'Transforms are not applied. The path data is edited as written and the summary notes that a transform on the path or its ancestors was ignored.',
      question: 'What happens to a transform attribute?',
    },
    {
      answer:
        'An arc stretched by different X and Y factors is no longer a circle or ellipse aligned with its own radii, so it is converted to cubic Béziers. A uniform scale keeps arcs and scales their radii.',
      question: 'Why did my arcs turn into curves?',
    },
    {
      answer:
        'Path data of up to 100,000 characters and 20,000 segments, with 0 to 6 decimals. The preview marks up to 2,000 points; above that it draws the path only.',
      question: 'What are the limits?',
    },
    {
      answer:
        'The editor stops at the first invalid character and names its position, for example "Invalid path data at character 17: expected a number." Browsers silently draw up to the error instead.',
      question: 'Why is my path rejected when a browser draws it?',
    },
  ],
  help: 'Paste path data such as M10 10 L 90 90, a <path> element or an SVG document with one <path>.\n\nPick an operation: Format, Absolute, Relative, Minify, Translate (Offset x, Offset y) or Scale (Scale x, Scale y). Set the precision from 0 to 6 decimals.\n\nThe preview draws the result on a checkerboard with end points as circles and control points as squares. Switch Display between stroke and fill.\n\nCopy the new path data, or save path.svg sized to the bounding box and path.json with every command in written and absolute form, the box and the length.',
  notes: [
    'Everything runs locally; no path is uploaded.',
    'Exactly one <path> is read from SVG markup; transforms are ignored with a note.',
    'Path data follows the SVG 2 grammar, including exponents and compact arc flags such as a1 1 0 00 1 1.',
    'The first invalid character is an error with its position; nothing is drawn up to it.',
    'Non-uniform scaling converts arcs to cubic Béziers; uniform scaling keeps them.',
    'Limits: 100,000 characters, 20,000 segments, precision 0 to 6, offsets up to ±1,000,000, scale factors from ±0.001 to ±1,000.',
    'The preview marks up to 2,000 points; dragging points is not supported yet.',
  ],
};

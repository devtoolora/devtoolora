import type { ToolContent } from '@devtoolora/core';

export const content: ToolContent = {
  documentation: [
    {
      content:
        'clip-path hides every part of an element outside a shape without changing the element’s layout box. This generator writes the four CSS basic shapes: polygon() from ordered points, circle(), ellipse() and inset() with optional rounded corners.\n\nAll positions are percentages of the element box: 0% 0% is the top-left corner and 100% 100% the bottom-right. The shape stretches with the element, so a different aspect ratio changes how it looks.\n\nPick a preset, drag the numbered handles or the whole polygon, or set a circle, ellipse or inset with sliders. Show outside clip-path dims the hidden area instead of removing it, and a local preview image or surface only shows the shape over a picture; it is never cropped, uploaded or exported.',
      title: 'What is a CSS clip path?',
    },
    {
      content: [
        'Create angled section edges, hexagon or circle avatars, arrows, chevrons, badges, speech bubbles and star shapes.',
        'Start from one of 28 presets and reshape it by dragging instead of typing coordinates.',
        'Check the point order and the clipped result over your own image before writing CSS.',
        'Copy an .element rule, with a -webkit-clip-path line for old browsers when you need it, and test it on the real element.',
      ],
      title: 'When to use CSS Clip-Path Generator',
    },
  ],
  examples: [
    'Polygon [[50,0],[100,100],[0,100]] → clip-path: polygon(50% 0%, 100% 100%, 0% 100%); a triangle.',
    'Circle, Radius 50, Center 50 50 → clip-path: circle(50% at 50% 50%);',
    'Ellipse, Radius X 50, Radius Y 35, Center 50 50 → clip-path: ellipse(50% 35% at 50% 50%);',
    'Inset 10% on every side with Corner radius 16 → clip-path: inset(10% 10% 10% 10% round 16px);',
    'Circle with Add -webkit- prefix → -webkit-clip-path: circle(50% at 50% 50%); followed by the same clip-path line.',
    '[[12.345,0],[100,100],[0,100]] → polygon(12.35% 0%, 100% 100%, 0% 100%); coordinates are rounded to two decimals.',
    '[[120,50],[100,100],[0,100]] or Inset top 60 with Inset bottom 40 → an error; values are not clamped.',
  ],
  faq: [
    {
      answer:
        'Each point is an x y pair in percent of the element box, measured from the top-left corner: 50% 0% is the middle of the top edge and 100% 100% the bottom-right corner. Points join in order and the last connects back to the first.',
      question: 'How do clip-path polygon coordinates work?',
    },
    {
      answer:
        'No. It only hides parts of the element when the page is drawn; the image file is unchanged and is still downloaded in full. To save a cropped image, use Image Tools.',
      question: 'Does clip-path crop my image file?',
    },
    {
      answer:
        'Yes. Open Points JSON (advanced) and enter [x, y] pairs such as [[50,0],[100,100],[0,100]]. Values must be numbers from 0 to 100 and are rounded to two decimals.',
      question: 'Can I type exact coordinates?',
    },
    {
      answer:
        'The layout stays the same: the element keeps its full box and nearby content does not move. Clicks and hovers only reach the element inside the visible shape.',
      question: 'Does clip-path change the layout or the click area?',
    },
    {
      answer:
        'No. The image is read on this device to show behind the shape and is never uploaded, stored in the tool settings or included in the CSS or audit.',
      question: 'Is my preview image uploaded?',
    },
    {
      answer:
        'Not for current browsers, which all support unprefixed clip-path with these shapes. Turn on Add -webkit- prefix only if you support Safari 13 or older; it adds a -webkit-clip-path line with the same value.',
      question: 'Do I need the -webkit-clip-path prefix?',
    },
  ],
  help: 'Choose a Shape (Polygon, Circle, Ellipse or Inset) or click a preset above the canvas; Apply sample lists the same presets.\n\nFor a polygon, drag a numbered handle, or drag inside the shape to move all points at once. Press Click canvas to add and click where the new point goes, or select a handle and press Remove selected point; a polygon keeps 3 to 64 points.\n\nFocus a handle and use the arrow keys to move it by 1%, or Shift+arrow by 10%. For a circle or ellipse drag the center handle and set the radius with the sliders; for an inset set each edge and Corner radius.\n\nTurn on Show outside clip-path to see what is hidden, switch the Preview surface or choose a local image, then copy the CSS or download clip-path.css and css-clip-path-report.json; open Points JSON (advanced) to type exact coordinates.',
  notes: [
    'polygon() takes 3 to 64 ordered points, and the last point connects back to the first. circle() and ellipse() radii and centers, and the four inset edges, are percentages from 0 to 100; Corner radius is 0 to 200 px.',
    'Points JSON must be an array of [x, y] pairs of finite numbers from 0 to 100. Strings, extra values, out-of-range numbers and invalid JSON show an error instead of being coerced or clamped; dragging keeps points inside 0–100%.',
    'Inset top plus bottom, and left plus right, must stay below 100%, otherwise nothing would remain visible. Coordinates are rounded to two decimals.',
    'A circle’s percentage radius is measured against the box diagonal divided by √2, so on a non-square element circle(50%) does not touch every edge; use an ellipse to follow the box.',
    'Current browsers support unprefixed clip-path. Add -webkit- prefix only for Safari 13 and older or similar old WebKit browsers.',
    'Self-intersecting, duplicate and collinear points are valid CSS and can produce odd or invisible areas. Clipping also hides outlines and removes clicks outside the shape, so test interactive content.',
    'The preview image accepts PNG, JPEG or WebP up to 5 MiB and stays on this device; the image, surface and Show outside setting are not part of the CSS or the audit. Points JSON is limited to 10,000 characters.',
  ],
};

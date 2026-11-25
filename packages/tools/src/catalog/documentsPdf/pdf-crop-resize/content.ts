import type { ToolContent } from '@devtoolora/core';

export const content: ToolContent = {
  documentation: [
    {
      content:
        'Crop sets the visible area of each selected page to its current visible area (the CropBox, or the MediaBox when there is none) minus the margins you enter. Margins follow the page as you see it, so Top is the top edge on screen even when the page is stored rotated by 90, 180 or 270 degrees. The MediaBox is not changed, which means the cropped content is still inside the file and a PDF editor can bring it back. This is a view crop, not a way to remove sensitive content.\n\nIf the margins would leave a page narrower or shorter than 1 pt, the tool stops and names the page.',
      title: 'How cropping works',
    },
    {
      content: [
        'Resize changes the page to A3, A4, A5, Letter, Legal, Tabloid or a custom size. Orientation Auto keeps each page portrait or landscape as it is displayed; Portrait and Landscape force one.',
        'With Scale content on, the visible area is scaled uniformly to fit the new page and centered, so nothing is stretched or cut. With it off, the content keeps its size and is centered, and anything that does not fit is clipped.',
        'Annotation rectangles (comments, link areas, ink) move and scale with the content; the destination coordinates that links and outlines point to are kept as they are. MediaBox and CropBox both become the new size.',
        'The result lists every changed page as JSON with its size before and after in points, with millimetres alongside.',
      ],
      title: 'Resizing pages',
    },
  ],
  examples: [
    'Trim a 10 mm scanner border by cropping 10 mm on every side.',
    'Remove a running header by cropping only the top margin on all pages.',
    'Crop only page 2 by entering 2 in Pages.',
    'Turn Letter pages into A4 with Scale content on.',
    'Make landscape slides A5 landscape by choosing Orientation Landscape.',
    'Enter margins in inches or points by switching the unit first.',
  ],
  faq: [
    {
      answer:
        'No. Crop only moves the visible window, so the original content stays in the file. Use a redaction tool to remove content for good.',
      question: 'Does cropping delete the content outside the margins?',
    },
    {
      answer:
        'Because the page is stored rotated. Margins always follow the displayed page, so Top is the top you see on screen.',
      question: 'Why is a rotated page cropped on the side I did not expect?',
    },
    {
      answer:
        'Turn on Scale content. Without it the page content keeps its size, is centered and anything beyond the new page is clipped.',
      question: 'Why is my content cut off after resizing?',
    },
    {
      answer:
        'Auto picks portrait or landscape per page from the displayed shape of that page. A square page counts as portrait.',
      question: 'What does Auto orientation do?',
    },
  ],
  help: 'Choose a PDF and an action. Crop removes margins from the visible area, Resize changes the paper size.\n\nPick the unit, then enter the four margins for Crop. They apply to the page as you see it.\n\nFor Resize choose a paper size or enter a custom width and height, pick an orientation and decide whether the content is scaled.\n\nLeave Pages blank for all pages or enter a selection such as 1-3, 5 or odd, then save the new PDF.',
  notes: [
    'Everything runs locally with pdf-lib; the PDF never leaves your device.',
    'Crop keeps the MediaBox, so cropped content can be recovered and is not removed.',
    'Margins follow the displayed page, including pages stored with a 90, 180 or 270 degree rotation.',
    'An existing CropBox is the starting point for cropping, and pages whose box does not start at 0,0 work.',
    'Resize sets MediaBox and CropBox to the new size and moves annotations with the content.',
    'Pages outside the selection are left exactly as they are.',
  ],
};

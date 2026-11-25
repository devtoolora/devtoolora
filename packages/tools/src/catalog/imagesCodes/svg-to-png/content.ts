import type { ToolContent } from '@devtoolora/core';

export const content: ToolContent = {
  documentation: [
    {
      content: [
        'SVG to PNG renders SVG markup, pasted or from an .svg file, to a PNG image that you download as rendered.png.',
        'The output size comes from the SVG’s width and height, or its viewBox when they are missing, scaled to fit Max width and Max height while keeping the aspect ratio. Areas without shapes stay transparent.',
      ],
      title: 'What is SVG to PNG?',
    },
    {
      content: [
        'Create PNG versions of icons and logos for app stores, email, documents, social profiles or anywhere SVG is not accepted.',
        'Rasterize a QR code or a placeholder from the other tools at an exact pixel size.',
      ],
      title: 'When to use SVG to PNG',
    },
  ],
  examples: [
    '<svg viewBox="0 0 24 24"> with Max width 512 → 512 × 512 PNG.',
    '<svg width="48" height="32"> without a viewBox and no limits → 48 × 32 PNG.',
    'The same SVG with Max width 96 → 96 × 64 PNG.',
    '<svg viewBox="0 0 160 40"> with Max width 400 and Max height 80 → 320 × 80 PNG, limited by the height.',
    '<svg width="128" height="128" viewBox="0 0 24 24"> with no limits → 128 × 128 PNG, because width and height win over the viewBox size.',
    '<svg width="100" viewBox="0 0 50 25"> → 100 × 50 PNG, with the height taken from the viewBox ratio.',
    '<svg viewBox="0 0 24 24"> with only Max height 256 → still 24 × 24, because Max width defaults to the SVG’s own width.',
    '<?xml version="1.0"?> and a comment before <svg …> → rendered as usual; <div><svg …> → error: Paste valid SVG markup starting with <svg>.',
  ],
  faq: [
    {
      answer:
        'The size comes from width and height, from the viewBox when they are missing or in %, and 300 × 150 when neither is set; a lone width or height follows the viewBox ratio. Max width and Max height scale it to fit both limits, so viewBox="0 0 24 24" with Max width 512 gives 512 × 512.',
      question: 'How big will the PNG be?',
    },
    {
      answer:
        'Max width defaults to the SVG’s own width, so a Max height alone can only shrink the image. Enter Max width as well, or only Max width, to scale it up.',
      question: 'Why is my PNG still small when I set only Max height?',
    },
    {
      answer:
        'The browser draws the PNG the way it draws an SVG in an <img>: groups, CSS, gradients and text all work, but scripts do not run, and linked images, stylesheets and web fonts are not loaded. Text uses the fonts on your device, so convert it to paths or embed images as data: URIs when the result must look the same everywhere.',
      question: 'Why does the PNG look different from the SVG in my browser?',
    },
    {
      answer:
        'The markup, pasted or from a file, must have <svg as its first element. An XML declaration, comments and a doctype before it are skipped, but HTML around the SVG, such as <div><svg>, is refused; copy only the <svg> element.',
      question: 'Why do I get “Paste valid SVG markup starting with <svg>”?',
    },
    {
      answer:
        'Add a <rect> as the first shape that covers the whole viewBox, such as <rect width="24" height="24" fill="#ffffff"/> for viewBox="0 0 24 24".',
      question: 'How do I get a white background instead of transparency?',
    },
  ],
  help: 'Paste SVG markup, or choose an SVG file; an XML declaration, comments or a doctype may come before <svg, and pasted text wins when both are present.\n\nLeave Max width and Max height empty to keep the SVG’s own size, or enter a size such as 512 to scale it up or down.\n\nRun the tool and check the preview, including the edges and the transparent areas.\n\nDownload rendered.png.',
  notes: [
    'Rendering uses your browser’s own SVG engine on your device; the SVG is not uploaded, and images or web fonts it links to are not loaded.',
    'Malformed XML, such as an unclosed tag or an undeclared namespace prefix like xlink: without xmlns:xlink, gives an error rather than a partial image.',
    'Output is limited to 10,000 px per side; larger values are reduced to that limit.',
    'Width and height in px, pt, pc, mm, cm or in are converted at 96 px per inch; percentages and em values are ignored in favor of the viewBox.',
    'The PNG is transparent wherever the SVG draws nothing; add a full-size <rect> with a fill for a solid background.',
  ],
};

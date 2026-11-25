import type { ToolContent } from '@devtoolora/core';

export const content: ToolContent = {
  documentation: [
    {
      content:
        'XML describes a document with named elements, attributes and text; formatting makes an element hierarchy easier to inspect.\n\nThis formatter parses the document first, then adjusts layout between structural nodes. Text-only elements, mixed content, CDATA and xml:space="preserve" regions stay intact.',
      title: 'What is XML formatting?',
    },
    {
      content: [
        'Read a compact XML response, configuration or exported document without manually adding line breaks.',
        'Check matching tags, quoted attributes, character references and a single document root before copying the result.',
        'Apply consistent indentation while keeping sentences with inline tags and protected whitespace unchanged.',
      ],
      title: 'When to format XML',
    },
  ],
  examples: [
    '<root><item/><item>Text</item></root> → the two item elements appear on separate indented lines.',
    '<p>Hello <strong>world</strong>!</p> → stays inline; no spaces or line breaks are inserted into the sentence.',
    '<item note="a > b">A &amp; B</item> → the quoted > and the original entity spelling stay unchanged.',
    '<code xml:space="preserve">  first\\n  second  </code> → the whitespace inside code stays exactly as supplied.',
  ],
  faq: [
    {
      answer:
        'Only HTML that is also well-formed XML. An unclosed tag such as <br>, an unquoted attribute or a named entity like &nbsp; is an XML error, so most ordinary HTML is rejected.',
      question: 'Can XML Format format HTML?',
    },
    {
      answer:
        'Elements that mix text with child tags, contain CDATA or use xml:space="preserve" are left as written, because new line breaks there would change the text. Only purely structural children are moved onto their own lines.',
      question: 'Why is part of my XML still on one line?',
    },
    {
      answer:
        'DOCTYPE and DTD declarations are refused so that no external entity or schema can be loaded. Remove the DOCTYPE line and replace any entities it defined, then format the rest of the document.',
      question: 'Why is my DOCTYPE rejected?',
    },
    {
      answer:
        'No. XML Format only indents; it has no minify mode, and structural child elements always end up on separate lines.',
      question: 'Can I minify XML with this tool?',
    },
    {
      answer:
        'No. Attributes keep their order, quote style and spacing exactly as written; only the layout whitespace between elements and other nodes changes.',
      question: 'Does XML Format change attribute order or quotes?',
    },
  ],
  help: 'Paste one well-formed XML document or choose a sample. Use XML, not HTML with optional closing tags.\n\nChoose 2 spaces, 4 spaces or Tabs under Indentation, then select Run XML Format.\n\nIf parsing fails, use the line and column in the error to fix the unclosed tag, unquoted attribute or undefined entity, then run again.\n\nInspect the formatted hierarchy, then copy it or save formatted.xml. Mixed-content regions may remain on one line to avoid changing their text.',
  notes: [
    'Processing is local. DOCTYPE and DTD declarations are rejected; external entities and schemas are never fetched.',
    'Whitespace used only as layout between element children is normalized. Leaf text, mixed content, CDATA, entity spellings, comments, attribute order and quote styles are retained.',
    'Well-formedness checking is not XSD/DTD validation or namespace-binding validation. XML 1.0 is supported; HTML and XML fragments with multiple roots are not.',
    'The limit is 5,000,000 input characters, 100 nested element levels and 100,000 nodes. Output is never silently truncated.',
    'Save exports UTF-8. Documents that declare a non-UTF-8 encoding must be decoded and have their encoding declaration updated before using this text tool.',
  ],
};

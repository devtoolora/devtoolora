import type { ToolContent } from '@devtoolora/core';

export const content: ToolContent = {
  documentation: [
    {
      content:
        'YAML is an indentation-based data format used for configuration, CI pipelines and Kubernetes manifests. Formatting rewrites its layout without changing the data.\n\nThis tool parses the text as YAML 1.2, then prints each document again with 2 or 4 space indentation. Comments, anchors and aliases stay in place.',
      title: 'What is YAML formatting?',
    },
    {
      content: [
        'Clean up a hand-edited config so every level uses the same indentation.',
        'Check a manifest or workflow file for syntax errors and duplicate keys before committing it.',
        'Count and normalize the documents of a multi-document stream separated by ---.',
      ],
      title: 'When to format YAML',
    },
  ],
  examples: [
    'a:   1 and b: [1,2] → a: 1 and b: [ 1, 2 ], with single spaces and normalized flow lists.',
    '# note above a key → the comment stays next to the same key after formatting.',
    'x: &a 1 followed by y: *a → the anchor and the alias are kept, not expanded.',
    'a: 1 twice in one mapping → an error that names the line and column of the duplicate.',
  ],
  faq: [
    {
      answer: 'No. YAML forbids tab characters for indentation, so only 2 or 4 spaces are offered.',
      question: 'Can I indent YAML with tabs?',
    },
    {
      answer:
        'Yes. Comments are kept with the node they belong to. Their exact column may move when indentation changes.',
      question: 'Does formatting remove comments?',
    },
    {
      answer:
        'Duplicate keys are rejected because most parsers silently keep only one of them. Remove or rename the repeated key and run again.',
      question: 'Why is a duplicate key an error?',
    },
    {
      answer:
        'Each document is formatted on its own and the documents are joined with --- lines. Up to 100 documents are accepted.',
      question: 'How are multiple documents handled?',
    },
    {
      answer:
        'Aliases are checked but never expanded in the output. Input that would expand to more than 10,000 aliases is refused.',
      question: 'Are anchors and aliases expanded?',
    },
  ],
  help: 'Paste YAML or choose a sample.\n\nChoose Format to rewrite the text with 2 or 4 space indentation, or Validate to only check the syntax and count documents.\n\nIf parsing fails, use the line and column in the error to fix the problem, then run again.\n\nCopy the result or save formatted.yaml.',
  notes: [
    'Processing is local; nothing is uploaded.',
    'The text is read as YAML 1.2. Anchors, aliases and comments are kept; long lines are not wrapped.',
    'Validate mode returns your input unchanged and reports the document count.',
    'The limit is 5,000,000 input characters, 100 documents, 100 nesting levels and 10,000 alias expansions. Output is never silently truncated.',
  ],
};

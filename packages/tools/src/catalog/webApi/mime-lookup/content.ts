import type { ToolContent } from '@devtoolora/core';

export const content: ToolContent = {
  documentation: [
    {
      content: [
        'A media type identifies a representation, such as application/json or image/svg+xml. File extensions are naming conventions, not proof of content.',
        'This local reference maps a curated set of extensions and media types. It accepts bare/dotted extensions, filenames, hierarchical URL paths or a known MIME type.',
        'Reverse lookup can return multiple extensions for one type. MIME parameters are ignored for lookup, but can still be important when interpreting the actual content.',
      ],
      title: 'What is a MIME type lookup?',
    },
    {
      content: [
        'Check a familiar extension or Content-Type spelling.',
        'Find bundled extension aliases for a known media type.',
        'Inspect an URL pathname without downloading its resource; use content-aware tooling for actual file identification.',
      ],
      title: 'When to use MIME Lookup',
    },
  ],
  examples: [
    'json, .JSON or report.JSON → json: application/json.',
    'image/jpeg → jpeg: image/jpeg and jpg: image/jpeg.',
    'application/json; charset=utf-8 → json: application/json, ignoring the parameter.',
    'https://example.com/report.json?q=pdf → json: application/json, from the path, not the query.',
    'Empty input → all 24 bundled mappings, from .css: text/css to .zip: application/zip.',
    'file.unknown → No MIME mapping found in the bundled reference.',
  ],
  faq: [
    {
      answer:
        'text/javascript. RFC 9239 made it the standard type for JavaScript and marked application/javascript obsolete, and this lookup returns text/javascript for .js.',
      question: 'What is the MIME type for .js files?',
    },
    {
      answer:
        'No. It maps only the extension or type you type; no file is opened, read or uploaded. A renamed file gets the type of its new extension here, so use a content check such as file --mime-type when the real format matters.',
      question: 'Does it detect a file’s type from its contents?',
    },
    {
      answer:
        '24: css, csv, gif, htm, html, ico, jpeg, jpg, js, json, md, mp3, mp4, pdf, png, svg, txt, wasm, webp, woff2, xml, yaml, yml and zip. Leave the input empty to see the table; other extensions, such as the .gz of .tar.gz, are not mapped.',
      question: 'Which extensions are included?',
    },
    {
      answer:
        'Because that would be a guess. application/octet-stream is the generic type servers fall back to for unknown binary data, not a mapping for a specific extension, so the tool says No MIME mapping found instead.',
      question: 'Why does an unknown extension not return application/octet-stream?',
    },
    {
      answer:
        'application/yaml, registered by RFC 9512 in 2024. Both .yaml and .yml map to it here; older servers and tools may still send text/yaml or application/x-yaml.',
      question: 'What is the MIME type for YAML files?',
    },
  ],
  help: 'Leave the input empty to browse the bundled mapping table.\n\nEnter an extension, filename, URL or known type, or apply a sample.\n\nRead all returned aliases; unknown inputs are reported explicitly.\n\nCopy or download the text. No file is opened or uploaded.',
  notes: [
    'Raw input is limited to 4,096 UTF-16 characters; surrounding whitespace is ignored and extension/type matching is case-insensitive.',
    'Only the final filename suffix is considered, so compound extensions and extensionless content may not be identified.',
    'The mapping table is intentionally limited, not the full IANA media type registry or a universal extension database.',
    'MIME parameters are ignored for this exact-type lookup; wildcard Accept negotiation is unsupported.',
    'A filename or supplied Content-Type can be misleading. No magic-byte detection, download, file parsing or safety check occurs.',
    'An unknown mapping does not imply an invalid or unregistered media type.',
    'Registry reference: https://www.iana.org/assignments/media-types (checked 2026-10-13).',
  ],
};

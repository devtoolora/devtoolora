import type { ToolContent } from '@devtoolora/core';

export const content: ToolContent = {
  documentation: [
    {
      content:
        'Sort keys rewrites a JSON document so every object lists its keys in order, recursively. Arrays keep their item order, because the order of array items carries meaning.\n\nCanonical mode produces the JSON Canonicalization Scheme from RFC 8785 (JCS). The output has no whitespace, keys sorted by UTF-16 code units, strings escaped the way ECMAScript escapes them and numbers written in the shortest ECMAScript form. Two systems that canonicalize equal data get byte-identical text.\n\nKeys are compared by UTF-16 code units, not by locale. Uppercase letters sort before lowercase ones, and characters outside the Basic Multilingual Plane sort by their surrogate pairs.',
      title: 'What is JSON canonicalization?',
    },
    {
      content: [
        'Sign or hash a JSON payload so the signature does not depend on key order or formatting.',
        'Compare two documents byte for byte after sorting their keys.',
        'Keep configuration files and fixtures stable so diffs show only real changes.',
        'Check what a verifier will see before you feed JSON into the Hash or HMAC tool.',
      ],
      title: 'When to use JSON Sort Keys & Canonicalize',
    },
  ],
  examples: [
    '{"b":1,"a":{"d":[2,1],"c":"é"}} canonical → {"a":{"c":"é","d":[2,1]},"b":1}.',
    '[1E30, 4.50, 2e-3, -0] canonical → [1e+30,4.5,0.002,0].',
    '{"z":1,"é":2,"a":3} sorted ascending → keys a, z, é.',
    '{"a":1,"b":2} sorted descending → keys b, a.',
    '{"b":[{"y":1,"x":2}]} sorted → the array stays in place, only the inner keys are sorted.',
  ],
  faq: [
    {
      answer:
        'JCS is the JSON Canonicalization Scheme from RFC 8785. It defines one exact text form for any JSON value, so signatures and hashes of equal data always match.',
      question: 'What is JCS?',
    },
    {
      answer:
        'JCS writes numbers the way ECMAScript does, so 1E30 becomes 1e+30 and 4.50 becomes 4.5. The value is the same IEEE-754 double, only its text form is fixed.',
      question: 'Why does 1E30 change?',
    },
    {
      answer:
        'A signature or hash covers bytes, not meaning. Two equal documents with different key order or spacing would produce different digests. Canonical text removes that difference before you sign or hash.',
      question: 'Why canonicalize before signing or hashing?',
    },
    {
      answer:
        'Array order is data: [1,2] and [2,1] are different values. Only object keys have no defined order, so only they are sorted.',
      question: 'Why do arrays stay in their order?',
    },
  ],
  help: 'Paste JSON and choose Sort keys or Canonical. Sort keys keeps the document readable and lets you pick ascending or descending order and the indentation.\n\nCanonical mode ignores order and indentation and returns compact RFC 8785 text. The summary shows its size in UTF-8 bytes, which is the length a signature or hash covers.\n\nBoth modes parse the input as JSON first, so comments, trailing commas and single quotes are rejected with an error.\n\nUse Sort keys for diffs and review, and Canonical for signing, hashing and cache keys.',
  notes: [
    'Runs locally and offline; the input is never uploaded.',
    'Nesting is limited to 64 levels; deeper input is rejected, not truncated.',
    'Canonical mode reads numbers as IEEE-754 doubles, as RFC 8785 requires, so integers outside ±9,007,199,254,740,991 are rounded. Sort keys mode rejects them instead; quote them as strings to keep their exact digits.',
    'Duplicate keys in the input collapse to the last value, because the JSON parser keeps only one.',
    'A number beyond the range of a double, such as 1e400, or one that would become 0, such as 1e-400, is rejected in both modes. Canonical mode also rejects a string with an unpaired surrogate, as RFC 8785 requires.',
  ],
};

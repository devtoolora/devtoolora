import type { ToolContent } from '@devtoolora/core';

export const content: ToolContent = {
  documentation: [
    {
      content: [
        'A prompt template is a prompt with placeholders. The fixed instructions stay in the template, and the parts that change, such as a customer name, a list of documents or a question, come from variables. Keeping the two apart makes prompts easier to review, test and reuse.',
        'This tool uses a subset of Mustache, a logic-less template language. {{name}} inserts a value, {{a.b}} follows a path into an object, and {{.}} is the current item. A section {{#items}}…{{/items}} repeats for every array item, renders once for any other truthy value and is skipped for false, null, 0, an empty string or an empty array. An inverted section {{^items}}…{{/items}} renders only when the value is missing or falsy.',
        'Lookups walk the context stack as in Mustache: inside a section the current item is searched first, then the enclosing values. Only own keys count, so names such as constructor or __proto__ are ordinary keys. A line that holds only a section tag, a closing tag or a comment is removed with its line break, so block tags do not leave blank lines in the prompt.',
      ],
      title: 'What is a prompt template?',
    },
    {
      content: [
        'Fill a system or user prompt with values before you paste it into a chat or an API playground.',
        'Build retrieval prompts that list several source documents with their ids and titles.',
        'Render few-shot examples from a JSON array, so adding an example does not mean editing the prompt.',
        'Check that every placeholder in a template has a value, or keep the unknown ones visible for a later pass.',
      ],
      title: 'When to use Prompt Template Renderer',
    },
  ],
  examples: [
    'Hello {{name}} with {"name":"Ada"} → Hello Ada',
    '{{#docs}}- {{title}}\\n{{/docs}} with two docs → one line per document',
    '{{^notes}}No notes.{{/notes}} with {"notes":[]} → No notes.',
    '{{args}} with {"args":{"city":"Prague"}} → {"city":"Prague"}',
    '{{name}} with {} and Missing variables set to Error → Variable "name" is missing (line 1).',
    '{{x}} with {"x":"<b>"} and Escape set to HTML → &lt;b&gt;; {{{x}}} stays <b>',
  ],
  faq: [
    {
      answer:
        'No. Partials ({{> name}}), delimiter changes ({{= =}}) and lambdas are not supported, and a partial or delimiter tag is an error that names its line. Everything else in the subset follows the Mustache spec, including the standalone-line rule.',
      question: 'Is this full Mustache or Handlebars?',
    },
    {
      answer:
        'Error stops with the name and line of the first missing variable. Empty prints nothing in its place. Keep leaves the tag as written, for example {{customer.name}}, and lists the kept names in the summary. A missing section name counts as false in every mode.',
      question: 'What happens to a missing variable?',
    },
    {
      answer:
        'Prompts are plain text, so nothing is escaped by default. Choose HTML escaping when the output goes into HTML: & " < > in values from {{x}} become entities. {{{x}}} and {{&x}} never escape.',
      question: 'Why is escaping off by default?',
    },
    {
      answer:
        'Strings print as they are, numbers and booleans as text, and null as nothing. A number a double cannot hold, such as 12345678901234567890, keeps its exact digits, and numbers such as 1e400 and 1e-400 are rejected. Objects and arrays print as compact JSON, which is handy for tool arguments and structured context.',
      question: 'How are values printed?',
    },
    {
      answer:
        'The template, the variables and the result stay in your browser or editor. Nothing is uploaded and no model is called.',
      question: 'Is my prompt sent anywhere?',
    },
  ],
  help: 'Write the template in the main input and the variables as JSON in the Variables field. An empty Variables field is the same as {}.\n\nUse {{name}} or {{a.b}} for values, {{#list}}…{{/list}} to repeat or show a block, {{^list}}…{{/list}} for a fallback, and {{! comment }} for notes that do not reach the output.\n\nMissing variables decides what an unknown variable does: Error stops with its name and line, Empty prints nothing, and Keep leaves the tag in place and lists it in the summary. Escape set to HTML turns & " < > into entities in {{name}} values.\n\nThe summary counts characters, distinct variable names, sections, section iterations and estimated tokens. Copy the result or save it as prompt.txt.',
  notes: [
    'Processing is local; nothing is uploaded and no model is called.',
    'The template is limited to 200,000 characters and the variables JSON to 1,000,000 characters.',
    'Variables may nest at most 64 levels and sections at most 32 levels.',
    'Rendering stops with an error after 100,000 section iterations, 5,000,000 render steps or 2,000,000 output characters; nothing is cut silently.',
    'Partials, delimiter changes and lambdas are not supported.',
    'Only own keys are read, so __proto__ and constructor are ordinary names.',
    'The token count is an estimate, not a tokenizer; real counts vary by model.',
  ],
};

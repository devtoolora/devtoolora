import type { ToolContent } from '@devtoolora/core';

export const content: ToolContent = {
  documentation: [
    {
      content: [
        'Function calling, also called tool use, lets a language model ask your code to run a function. You describe each function with a name, a description and a JSON Schema for its arguments; the model then answers with a call whose arguments match that schema.',
        'Writing those schemas by hand is slow and easy to get wrong. This tool infers the schema from example arguments instead: every property gets the type its values have, a property that appears in every example is required, and one that some examples leave out is optional.',
        'The three providers want different wrappers. OpenAI nests the schema under function.parameters, Anthropic calls it input_schema, and Gemini lists functionDeclarations whose parameters follow an OpenAPI subset. OpenAI strict mode adds its own rules: closed objects, every property required and optional values written as nullable.',
      ],
      title: 'What is a function-calling schema?',
    },
    {
      content: [
        'Start a tool definition from a real call payload you already log or test with.',
        'Get the same tool as OpenAI, Anthropic and Gemini definitions when you compare or switch providers.',
        'Turn on OpenAI strict mode without rewriting optional properties as nullable by hand.',
        'Check which keywords strict mode would drop before you paste a schema into a request.',
      ],
      title: 'When to use Function-Calling Schema Builder',
    },
  ],
  examples: [
    '{"city":"Prague"} → parameters with city: string, required: ["city"]',
    '[{"q":"a","limit":5},{"q":"b"}] → q required, limit optional',
    'OpenAI strict, limit optional → limit: { type: ["integer", "null"] }, listed in required',
    'Anthropic → { name, description, input_schema }',
    'Gemini, zip "0150" or null → zip: { type: "string", nullable: true }',
    'Name "get weather" → Name must be 1-64 characters: letters, digits, _ or -.',
  ],
  faq: [
    {
      answer:
        'A property that is present in every example is required. A property that only some examples have is optional. Give several examples when some arguments are optional; one example makes every property required.',
      question: 'How does it decide what is required?',
    },
    {
      answer:
        'OpenAI strict mode needs every property in required and additionalProperties: false on every object. An optional property therefore becomes nullable, for example type: ["integer", "null"], and the model sends null when it has no value. Keywords that strict mode does not support are dropped and listed in the summary.',
      question: 'What changes in OpenAI strict mode?',
    },
    {
      answer:
        'The output uses the Chat Completions form, { type: "function", function: { name, description, parameters, strict } }. The Responses API puts the same fields at the top level: { type: "function", name, description, parameters, strict }.',
      question: 'Which OpenAI API shape is this?',
    },
    {
      answer:
        'Gemini reads an OpenAPI subset of JSON Schema. Type arrays become nullable: true or an anyOf, and additionalProperties is removed because Gemini does not accept it. A property that is null in every example gets a nullable string, because Gemini has no null type, and an array that is empty in every example gets string items. Both cases add a warning that names the property path.',
      question: 'Why does the Gemini schema look different?',
    },
    {
      answer:
        'Inference only sees the examples. Add property descriptions, enums and formats yourself when the model needs them; they are kept in strict mode where OpenAI supports them.',
      question: 'Can it add descriptions or enums?',
    },
  ],
  help: 'Paste example arguments as JSON in the main input: one object, or an array of 1-20 objects that are calls of the same function.\n\nSet the function name and a description that tells the model when to call it. The name may use letters, digits, _ and -, up to 64 characters; the description may have up to 1,024 characters.\n\nChoose a provider, or all to get { openai, anthropic, gemini } in one JSON document. Strict mode applies only to the OpenAI definition.\n\nThe summary estimates the tokens the compact definition adds to every request and lists keywords dropped by strict mode. Copy the JSON or save it as <name>.tools.json.',
  notes: [
    'Processing is local; nothing is uploaded and no model is called.',
    'The examples are limited to 1,000,000 characters, 50,000 values and 30 nesting levels; an array of examples counts as one level.',
    'The generated schema is limited to 5,000 values; nothing is cut silently.',
    'OpenAI Responses API form: { "type": "function", "name": ..., "description": ..., "parameters": ..., "strict": true }, the same fields without the function wrapper.',
    'OpenAI strict mode keeps only type, properties, required, additionalProperties, items, enum, anyOf and description.',
    'Integers and decimals are told apart: 3 gives integer, 3.5 gives number.',
    '$schema and title are removed, because the providers do not use them.',
    'Only own keys are read, so constructor is an ordinary name; __proto__ is kept as a pattern property, which strict mode drops; the Gemini definition lists it as an ordinary property.',
  ],
};

export type JsonlFormat = 'bedrock-claude' | 'openai-chat' | 'openai-preference';

export type LineFindings = { errors: string[]; warnings: string[] };

export type JsonRecord = { [key: string]: unknown };
type ChatLabels = { array: string; item: string };

const chatRoles = new Set(['system', 'developer', 'user', 'assistant', 'tool']);
const maxMessages = 2_048;
const topLevelKeys: { [format in JsonlFormat]: Set<string> } = {
  'bedrock-claude': new Set(['messages', 'system']),
  'openai-chat': new Set(['messages', 'parallel_tool_calls', 'tools']),
  'openai-preference': new Set(['input', 'non_preferred_output', 'preferred_output']),
};
const shownKeyChars = 64;

export const isRecord = (value: unknown): value is JsonRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const nonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value !== '';

const isTextPart = (part: unknown): boolean =>
  isRecord(part) && part.type === 'text' && typeof part.text === 'string';

const isChatContent = (content: unknown): boolean =>
  nonEmptyString(content) ||
  (Array.isArray(content) && content.length > 0 && content.every(isTextPart));

const parsesAsJson = (text: string): boolean => {
  try {
    JSON.parse(text);

    return true;
  } catch {
    return false;
  }
};

function checkToolCalls(calls: unknown, label: string, declared: Set<string>): string[] {
  if (!Array.isArray(calls)) return [`${label}: tool_calls must be an array.`];

  const errors: string[] = [];

  calls.forEach((call: unknown, index) => {
    const prefix = `${label}: tool call ${index + 1}`;
    const fn = isRecord(call) ? call.function : undefined;

    if (
      !isRecord(call) ||
      !nonEmptyString(call.id) ||
      call.type !== 'function' ||
      !isRecord(fn) ||
      !nonEmptyString(fn.name) ||
      typeof fn.arguments !== 'string'
    ) {
      errors.push(
        `${prefix} must have an id, type "function", function.name and function.arguments.`,
      );

      return;
    }

    declared.add(call.id);

    if (!parsesAsJson(fn.arguments)) errors.push(`${prefix} arguments must be valid JSON.`);
  });

  return errors;
}

/** One chat message; tool calls it declares are added to `declared`. */
function checkChatMessage(message: unknown, label: string, declared: Set<string>): string[] {
  if (!isRecord(message)) return [`${label} must be an object.`];

  const { role } = message;

  if (typeof role !== 'string' || !chatRoles.has(role))
    return [`${label}: role must be system, developer, user, assistant or tool.`];

  const errors: string[] = [];
  const callsOnly =
    role === 'assistant' &&
    message.tool_calls !== undefined &&
    !(Array.isArray(message.tool_calls) && message.tool_calls.length === 0) &&
    (message.content === undefined || message.content === null);

  if (!callsOnly && !isChatContent(message.content))
    errors.push(`${label}: content must be a non-empty string or an array of text parts.`);

  if (role === 'assistant' && message.tool_calls !== undefined)
    errors.push(...checkToolCalls(message.tool_calls, label, declared));

  if (
    role === 'tool' &&
    !(typeof message.tool_call_id === 'string' && declared.has(message.tool_call_id))
  )
    errors.push(`${label}: tool_call_id must name a tool call declared earlier.`);

  if (message.weight !== undefined) {
    if (role !== 'assistant')
      errors.push(`${label}: weight is allowed on assistant messages only.`);
    else if (message.weight !== 0 && message.weight !== 1)
      errors.push(`${label}: weight must be 0 or 1.`);
  }

  return errors;
}

function checkChatMessages(
  messages: unknown,
  labels: ChatLabels,
  requireAssistant: boolean,
): string[] {
  if (!Array.isArray(messages) || messages.length === 0 || messages.length > maxMessages)
    return [`${labels.array} must be an array of 1-2,048 messages.`];

  const declared = new Set<string>();
  const errors = messages.flatMap((message: unknown, index) =>
    checkChatMessage(message, `${labels.item} ${index + 1}`, declared),
  );

  if (
    requireAssistant &&
    !messages.some((message) => isRecord(message) && message.role === 'assistant')
  )
    errors.push('There must be at least one assistant message.');

  return errors;
}

function checkSingleOutput(output: unknown, key: string): string[] {
  const [message] = Array.isArray(output) ? output : [];

  if (
    !Array.isArray(output) ||
    output.length !== 1 ||
    !isRecord(message) ||
    message.role !== 'assistant'
  )
    return [`${key} must be an array of exactly one assistant message.`];

  return checkChatMessage(message, `${key} message`, new Set());
}

function checkPreference(example: JsonRecord): string[] {
  const { input } = example;
  const inputErrors = isRecord(input)
    ? checkChatMessages(input.messages, { array: 'input.messages', item: 'Input message' }, false)
    : ['input must be an object with messages.'];

  return [
    ...inputErrors,
    ...checkSingleOutput(example.preferred_output, 'preferred_output'),
    ...checkSingleOutput(example.non_preferred_output, 'non_preferred_output'),
  ];
}

const nextRole = new Map([
  ['assistant', 'user'],
  ['user', 'assistant'],
]);

function expectedRole(messages: unknown[], index: number): string | undefined {
  if (index === 0) return 'user';

  const previous: unknown = messages[index - 1];

  return isRecord(previous) ? nextRole.get(String(previous.role)) : undefined;
}

function checkBedrockMessage(
  message: unknown,
  label: string,
  expected: string | undefined,
): string[] {
  if (!isRecord(message)) return [`${label} must be an object.`];
  if (message.role !== 'user' && message.role !== 'assistant')
    return [`${label}: role must be user or assistant.`];

  const errors =
    expected === undefined || message.role === expected
      ? []
      : [`${label} must be ${expected === 'user' ? 'a user' : 'an assistant'} message.`];

  if (!nonEmptyString(message.content))
    errors.push(`${label}: content must be a non-empty string.`);

  return errors;
}

function checkBedrock(example: JsonRecord): string[] {
  const { messages, system } = example;
  const errors =
    system === undefined || typeof system === 'string' ? [] : ['system must be a string.'];

  if (!Array.isArray(messages) || messages.length === 0)
    return [...errors, 'messages must be a non-empty array.'];

  messages.forEach((message: unknown, index) => {
    errors.push(
      ...checkBedrockMessage(message, `Message ${index + 1}`, expectedRole(messages, index)),
    );
  });

  const last: unknown = messages[messages.length - 1];

  if (!(isRecord(last) && last.role === 'assistant'))
    errors.push('The last message must be an assistant message.');

  return errors;
}

function unknownKeys(example: JsonRecord, format: JsonlFormat): string[] {
  return Object.keys(example)
    .filter((key) => !topLevelKeys[format].has(key))
    .map((key) => {
      const shown = key.length > shownKeyChars ? `${key.slice(0, shownKeyChars)}…` : key;

      return `Unknown top-level key ${JSON.stringify(shown)}.`;
    });
}

export function checkExample(example: JsonRecord, format: JsonlFormat): LineFindings {
  const warnings = unknownKeys(example, format);

  if (format === 'openai-preference') return { errors: checkPreference(example), warnings };
  if (format === 'bedrock-claude') return { errors: checkBedrock(example), warnings };

  const labels = { array: 'messages', item: 'Message' };

  return { errors: checkChatMessages(example.messages, labels, true), warnings };
}

export function detectFormat(example: unknown): JsonlFormat | undefined {
  if (!isRecord(example)) return undefined;
  if (example.input !== undefined && example.preferred_output !== undefined)
    return 'openai-preference';
  if (example.messages === undefined) return undefined;

  return typeof example.system === 'string' ? 'bedrock-claude' : 'openai-chat';
}

const messageTexts = (message: unknown): string[] => {
  if (!isRecord(message)) return [];

  const { content, tool_calls: calls } = message;
  const texts = typeof content === 'string' ? [content] : [];

  if (Array.isArray(content))
    for (const part of content)
      if (isRecord(part) && typeof part.text === 'string') texts.push(part.text);

  if (Array.isArray(calls))
    for (const call of calls)
      if (isRecord(call) && isRecord(call.function))
        texts.push(String(call.function.name), String(call.function.arguments));

  return texts;
};

export function exampleMessages(example: JsonRecord, format: JsonlFormat): unknown[] {
  const messages =
    format === 'openai-preference' && isRecord(example.input)
      ? example.input.messages
      : example.messages;

  return Array.isArray(messages) ? messages : [];
}

export function exampleTexts(example: JsonRecord, format: JsonlFormat): string[] {
  const outputs =
    format === 'openai-preference'
      ? [example.preferred_output, example.non_preferred_output].flatMap((output) =>
          Array.isArray(output) ? output : [],
        )
      : [];
  const system = typeof example.system === 'string' ? [example.system] : [];

  return [...system, ...[...exampleMessages(example, format), ...outputs].flatMap(messageTexts)];
}

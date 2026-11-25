import type { ToolContent } from '@devtoolora/core';

export const content: ToolContent = {
  documentation: [
    {
      content: [
        'Fine-tuning services read training data as JSON Lines: one JSON object per line, each line one example. A single malformed line, a missing assistant turn or a tool result without its call can make a whole training job fail after the upload.',
        'This tool checks every line before you upload. It knows three formats: OpenAI chat (messages with roles, text parts and tool calls), OpenAI preference pairs for direct preference optimization (input plus a preferred and a non-preferred answer) and Amazon Bedrock (Claude) (an optional system prompt plus alternating user and assistant turns).',
        'Besides errors it reports statistics: valid and invalid lines, messages and estimated tokens per example, role counts and duplicate examples. Two lines are duplicates when their JSON is equal after sorting the keys, so whitespace and key order do not hide a copy.',
      ],
      title: 'What does the JSONL Dataset Validator check?',
    },
    {
      content: [
        'Check a dataset before starting a paid fine-tuning job.',
        'Find the line that a training service rejected with a vague error.',
        'Catch tool messages whose tool_call_id no earlier call declared.',
        'Spot duplicate examples and extra keys left over from a data pipeline.',
      ],
      title: 'When to use JSONL Dataset Validator',
    },
  ],
  examples: [
    'A chat line with a user and an assistant message → valid, 2 messages.',
    'A chat line with only a user message → There must be at least one assistant message.',
    'A tool message with tool_call_id "call_9" and no earlier call → Message 3: tool_call_id must name a tool call declared earlier.',
    'Amazon Bedrock (Claude) turns user, user, assistant → Message 2 must be an assistant message.',
    'A blank line between two examples → Line 2 · error with the message Empty line.',
    'The same example twice with a different key order → Duplicates: 1 and Duplicate of line 1.',
  ],
  faq: [
    {
      answer:
        'Auto-detect looks at the first line that parses. input with preferred_output means OpenAI preference, a string system with messages means Amazon Bedrock (Claude), and messages alone means OpenAI chat. If the line fits none of them, choose the format yourself.',
      question: 'How is the format detected?',
    },
    {
      answer:
        'No. Tokens are estimated with the same heuristic as the Token Estimator, from the text of the messages, the system prompt and the tool calls. Real counts depend on the model tokenizer.',
      question: 'Are the token counts exact?',
    },
    {
      answer:
        'Each line is turned into canonical JSON with sorted keys, and its SHA-256 hash is compared with the earlier lines. Equal hashes mean equal examples.',
      question: 'How are duplicates found?',
    },
    {
      answer:
        'Yes. Line breaks may be LF or CRLF, a final line break is allowed and a byte order mark at the start is skipped with a warning.',
      question: 'Does it accept Windows line endings?',
    },
    {
      answer: 'Everything runs in your browser or editor. The dataset is not uploaded anywhere.',
      question: 'Is my dataset uploaded?',
    },
  ],
  help: 'Paste JSON Lines or choose a .jsonl file; a chosen file replaces the text. Leave the format on Auto-detect or pick OpenAI chat, OpenAI preference or Amazon Bedrock (Claude).\n\nEvery line is parsed and checked against the rules of the format: message roles, non-empty content, tool calls with JSON arguments, tool results that answer an earlier call, weights and the order of turns for Amazon Bedrock (Claude).\n\nThe report starts with the statistics: lines, valid and invalid examples, duplicates, messages and estimated tokens per example, and role counts. Then come the issues, each with its line number and severity.\n\nCopy the report or save it as dataset-report.txt; dataset-report.json holds every count and up to 10,000 issues.',
  notes: [
    'Processing is local; nothing is uploaded.',
    'The dataset is limited to 50 MiB, 100,000 lines and 1,000,000 characters per line; more is an error that names the limit.',
    'The report shows the first 500 issues and says how many there are; the counts are always exact.',
    'A file must be valid UTF-8; a byte order mark is skipped with a warning.',
    'Unknown top-level keys are warnings, so the line still counts as valid.',
    'Statistics cover valid examples only; for preference pairs the messages are those of the input.',
    'Token estimates are a heuristic, not a tokenizer; real counts vary by model.',
  ],
};

import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { FunctionError } from '../src/errors';
import { estimateTokens, formatJsonlReport, validateJsonlDataset } from '../src/ai';

type Format = Parameters<typeof validateJsonlDataset>[1];

const jsonl = (lines: unknown[]) =>
  `${lines.map((line) => (typeof line === 'string' ? line : JSON.stringify(line))).join('\n')}\n`;
const check = (lines: unknown[], format: Format = 'openai-chat') =>
  validateJsonlDataset(jsonl(lines), format);
const messagesOf = async (lines: unknown[], format: Format = 'openai-chat') =>
  (await check(lines, format)).issues.map(({ message }) => message);
const rejects = (action: () => Promise<unknown>, message: string) =>
  assert.rejects(action, (error) => error instanceof FunctionError && error.message === message);

const user = (content: unknown = 'Hi') => ({ content, role: 'user' });
const assistant = (content: unknown = 'Hello') => ({ content, role: 'assistant' });
const chat = (...messages: unknown[]) => ({ messages });
const call = (id: string, name = 'lookup', args = '{"q":1}') => ({
  function: { arguments: args, name },
  id,
  type: 'function',
});
const preference = (input: unknown, preferred: unknown, nonPreferred: unknown) => ({
  input,
  non_preferred_output: nonPreferred,
  preferred_output: preferred,
});
const pair = (...messages: unknown[]) =>
  preference({ messages }, [assistant('Good')], [assistant('Bad')]);

describe('JSONL dataset validator: openai-chat', () => {
  it('needs messages as an array of 1-2,048 items', async () => {
    const many = Array.from({ length: 2_048 }, (_, index) => (index % 2 ? assistant() : user()));

    assert.deepEqual(await messagesOf([chat(user(), assistant()), chat(...many)]), []);

    const message = 'messages must be an array of 1-2,048 messages.';

    assert.deepEqual(await messagesOf([chat(), chat(...many, user()), { messages: 'x' }]), [
      message,
      message,
      message,
    ]);
  });

  it('accepts only the listed roles', async () => {
    const valid = chat(
      { content: 'Be brief.', role: 'system' },
      { content: 'Use JSON.', role: 'developer' },
      user(),
      { content: null, role: 'assistant', tool_calls: [call('c1')] },
      { content: '42', role: 'tool', tool_call_id: 'c1' },
      assistant(),
    );

    assert.deepEqual(await messagesOf([valid]), []);

    assert.deepEqual(await messagesOf([chat({ content: 'x', role: 'bot' }, assistant())]), [
      'Message 1: role must be system, developer, user, assistant or tool.',
    ]);
  });

  it('needs content as a non-empty string or text parts', async () => {
    const parts = [
      { text: 'Part one', type: 'text' },
      { text: 'Part two', type: 'text' },
    ];

    assert.deepEqual(await messagesOf([chat(user(parts), assistant())]), []);

    const message = 'Message 1: content must be a non-empty string or an array of text parts.';

    assert.deepEqual(
      await messagesOf([
        chat(user(''), assistant()),
        chat(user([]), assistant()),
        chat(user([{ type: 'image_url' }]), assistant()),
        chat(user(5), assistant()),
        chat({ role: 'user' }, assistant()),
      ]),
      [message, message, message, message, message],
    );
  });

  it('checks every assistant tool call', async () => {
    const valid = chat(user(), { role: 'assistant', tool_calls: [call('a'), call('b')] });

    assert.deepEqual(await messagesOf([valid]), []);

    const shape =
      'Message 2: tool call 1 must have an id, type "function", function.name and function.arguments.';

    assert.deepEqual(
      await messagesOf([
        chat(user(), { role: 'assistant', tool_calls: [{ ...call('a'), id: '' }] }),
        chat(user(), { role: 'assistant', tool_calls: [{ ...call('a'), type: 'tool' }] }),
        chat(user(), { role: 'assistant', tool_calls: [{ function: { name: 'x' }, id: 'a' }] }),
        chat(user(), { role: 'assistant', tool_calls: [call('a', 'x', '{oops')] }),
        chat(user(), { role: 'assistant', tool_calls: {} }),
      ]),
      [
        shape,
        shape,
        shape,
        'Message 2: tool call 1 arguments must be valid JSON.',
        'Message 2: tool_calls must be an array.',
      ],
    );
  });

  it('needs a tool message to answer an earlier call', async () => {
    const answered = chat(
      user(),
      { role: 'assistant', tool_calls: [call('c1')] },
      { content: 'ok', role: 'tool', tool_call_id: 'c1' },
      assistant(),
    );

    assert.deepEqual(await messagesOf([answered]), []);

    const message = 'Message 2: tool_call_id must name a tool call declared earlier.';

    assert.deepEqual(
      await messagesOf([
        chat(user(), { content: 'ok', role: 'tool', tool_call_id: 'c1' }, assistant()),
        chat(
          user(),
          { content: 'ok', role: 'tool', tool_call_id: 'c1' },
          { role: 'assistant', tool_calls: [call('c1')] },
        ),
        chat(user(), { content: 'ok', role: 'tool' }, assistant()),
      ]),
      [message, message, message],
    );
  });

  it('needs content or a tool call on an assistant message', async () => {
    assert.deepEqual(
      await messagesOf([chat(user(), { content: null, role: 'assistant', tool_calls: [] })]),
      ['Message 2: content must be a non-empty string or an array of text parts.'],
    );
  });

  it('needs an assistant reply after a lone Bedrock user turn', async () => {
    assert.deepEqual(await messagesOf([{ messages: [user()], system: 's' }], 'bedrock-claude'), [
      'The last message must be an assistant message.',
    ]);
  });

  it('needs at least one assistant message', async () => {
    assert.deepEqual(await messagesOf([chat(user(), assistant())]), []);

    assert.deepEqual(await messagesOf([chat(user())]), [
      'There must be at least one assistant message.',
    ]);
  });

  it('allows weight 0 or 1 on assistant messages only', async () => {
    const weighted = chat(user(), { ...assistant(), weight: 0 }, user(), {
      ...assistant(),
      weight: 1,
    });

    assert.deepEqual(await messagesOf([weighted]), []);

    assert.deepEqual(
      await messagesOf([
        chat(user(), { ...assistant(), weight: 0.5 }),
        chat({ ...user(), weight: 1 }, assistant()),
      ]),
      [
        'Message 2: weight must be 0 or 1.',
        'Message 1: weight is allowed on assistant messages only.',
      ],
    );
  });

  it('allows tools and parallel_tool_calls and warns about other top-level keys', async () => {
    const withTools = { ...chat(user(), assistant()), parallel_tool_calls: false, tools: [] };

    assert.deepEqual(await messagesOf([withTools]), []);

    const report = await check([{ ...chat(user(), assistant()), metadata: {} }]);

    assert.deepEqual(report.issues, [
      { line: 1, message: 'Unknown top-level key "metadata".', severity: 'warning' },
    ]);

    assert.equal(report.stats.valid, 1);
  });

  it('treats a tool call named __proto__ as an ordinary name', async () => {
    const line = chat(
      user(),
      { role: 'assistant', tool_calls: [call('__proto__', '__proto__')] },
      { content: 'ok', role: 'tool', tool_call_id: '__proto__' },
      assistant(),
    );

    assert.deepEqual(await messagesOf([line]), []);
  });
});

describe('JSONL dataset validator: openai-preference', () => {
  it('checks input.messages with the chat rules except the assistant requirement', async () => {
    assert.deepEqual(await messagesOf([pair(user())], 'openai-preference'), []);

    assert.deepEqual(
      await messagesOf(
        [
          pair({ content: 'x', role: 'bot' }),
          preference('x', [assistant()], [assistant()]),
          pair(),
        ],
        'openai-preference',
      ),
      [
        'Input message 1: role must be system, developer, user, assistant or tool.',
        'input must be an object with messages.',
        'input.messages must be an array of 1-2,048 messages.',
      ],
    );
  });

  it('needs preferred_output as exactly one assistant message', async () => {
    const message = 'preferred_output must be an array of exactly one assistant message.';

    assert.deepEqual(
      await messagesOf(
        [
          preference({ messages: [user()] }, [assistant(), assistant()], [assistant()]),
          preference({ messages: [user()] }, [user()], [assistant()]),
          preference({ messages: [user()] }, assistant(), [assistant()]),
          preference({ messages: [user()] }, [assistant('')], [assistant()]),
        ],
        'openai-preference',
      ),
      [
        message,
        message,
        message,
        'preferred_output message: content must be a non-empty string or an array of text parts.',
      ],
    );
  });

  it('needs non_preferred_output as exactly one assistant message', async () => {
    assert.deepEqual(
      await messagesOf(
        [preference({ messages: [user()] }, [assistant()], [])],
        'openai-preference',
      ),
      ['non_preferred_output must be an array of exactly one assistant message.'],
    );
  });
});

describe('JSONL dataset validator: bedrock-claude', () => {
  it('allows an optional string system prompt', async () => {
    const line = chat(user(), assistant());

    assert.deepEqual(
      await messagesOf([line, { ...line, system: 'Be brief.' }], 'bedrock-claude'),
      [],
    );

    assert.deepEqual(await messagesOf([{ ...line, system: 5 }], 'bedrock-claude'), [
      'system must be a string.',
    ]);
  });

  it('needs user and assistant turns that alternate, start with user and end with assistant', async () => {
    assert.deepEqual(
      await messagesOf([chat(user(), assistant(), user(), assistant())], 'bedrock-claude'),
      [],
    );

    assert.deepEqual(
      await messagesOf(
        [
          chat(assistant(), user(), assistant()),
          chat(user(), user(), assistant()),
          chat(user(), assistant(), user()),
          chat({ content: 'x', role: 'system' }, assistant()),
          chat(),
        ],
        'bedrock-claude',
      ),
      [
        'Message 1 must be a user message.',
        'Message 2 must be an assistant message.',
        'The last message must be an assistant message.',
        'Message 1: role must be user or assistant.',
        'messages must be a non-empty array.',
      ],
    );
  });

  it('needs content as a non-empty string', async () => {
    const message = 'Message 1: content must be a non-empty string.';

    assert.deepEqual(
      await messagesOf(
        [chat(user(''), assistant()), chat(user([{ text: 'x', type: 'text' }]), assistant())],
        'bedrock-claude',
      ),
      [message, message],
    );
  });
});

describe('JSONL dataset validator: input', () => {
  it('detects the format from the first line that parses', async () => {
    assert.equal(
      (await validateJsonlDataset(jsonl([pair(user())]), 'auto')).format,
      'openai-preference',
    );

    assert.equal(
      (
        await validateJsonlDataset(
          jsonl(['{', { ...chat(user(), assistant()), system: 'x' }]),
          'auto',
        )
      ).format,
      'bedrock-claude',
    );

    assert.equal(
      (await validateJsonlDataset(jsonl([chat(user(), assistant())]), 'auto')).format,
      'openai-chat',
    );

    await rejects(
      () => validateJsonlDataset(jsonl(['{', { prompt: 'x' }]), 'auto'),
      'Could not detect the format from line 2; choose one.',
    );
  });

  it('skips a byte order mark with a warning', async () => {
    const text = jsonl([chat(user(), assistant())]);
    const bytes = new Uint8Array([0xef, 0xbb, 0xbf, ...new TextEncoder().encode(text)]);
    const warning = {
      line: 1,
      message: 'The byte order mark at the start was skipped.',
      severity: 'warning',
    };

    for (const input of [`\uFEFF${text}`, bytes]) {
      const report = await validateJsonlDataset(input, 'auto');

      assert.deepEqual(report.issues, [warning]);
      assert.equal(report.stats.valid, 1);
    }
  });

  it('rejects bytes that are not UTF-8', async () => {
    await rejects(
      () => validateJsonlDataset(new Uint8Array([0x7b, 0xff, 0x7d]), 'openai-chat'),
      'The file is not valid UTF-8.',
    );
  });

  it('reports an empty line that is not the final newline', async () => {
    const line = chat(user(), assistant());
    const report = await validateJsonlDataset(
      `${JSON.stringify(line)}\n\n${JSON.stringify(chat(user('Other'), assistant()))}`,
      'openai-chat',
    );

    assert.deepEqual(report.issues, [{ line: 2, message: 'Empty line.', severity: 'error' }]);
    assert.deepEqual([report.stats.lines, report.stats.valid, report.stats.invalid], [3, 2, 1]);
    assert.equal((await check([line, ''])).stats.invalid, 1);
  });

  it('accepts CRLF files', async () => {
    const lines = [chat(user(), assistant()), chat(user()), '{"messages":'];
    const lf = await check(lines);
    const crlf = await validateJsonlDataset(jsonl(lines).replaceAll('\n', '\r\n'), 'openai-chat');

    assert.deepEqual(crlf, lf);
    assert.equal(crlf.stats.lines, 3);
  });

  it('allows 100,000 lines and rejects more', async () => {
    const report = await validateJsonlDataset('1\n'.repeat(100_000), 'openai-chat');

    assert.equal(report.stats.lines, 100_000);

    await rejects(
      () => validateJsonlDataset('1\n'.repeat(100_001), 'openai-chat'),
      'The dataset must have at most 100,000 lines.',
    );
  });

  it('allows lines of 1,000,000 characters and rejects longer ones', async () => {
    const line = (length: number) => {
      const shell = JSON.stringify(chat(user(''), assistant()));

      return JSON.stringify(chat(user('a'.repeat(length - shell.length)), assistant()));
    };

    assert.equal(line(1_000_000).length, 1_000_000);
    assert.equal((await check([line(1_000_000)])).stats.valid, 1);

    await rejects(
      () => check([chat(user(), assistant()), line(1_000_001)]),
      'Line 2 must be at most 1,000,000 characters.',
    );
  });

  it('rejects a file over 50 MiB', async () => {
    await rejects(
      () => validateJsonlDataset(new Uint8Array(50 * 1024 * 1024 + 1), 'openai-chat'),
      'The dataset must be at most 50 MiB.',
    );
  });

  it('accepts exactly 50 MiB and rejects one byte more', async () => {
    const limit = 50 * 1024 * 1024;
    const lineLength = 1_000_000;
    const lines: string[] = [];
    let size = 0;

    for (let index = 0; size < limit; index += 1) {
      const head = `{"messages":[{"role":"user","content":"u${index}"},{"role":"assistant","content":"`;
      const tail = '"}]}';
      const room = Math.min(lineLength, limit - size - 1);
      const line = `${head}${'a'.repeat(room - head.length - tail.length)}${tail}`;

      lines.push(line);
      size += line.length + 1;
    }

    const text = `${lines.join('\n')}\n`;

    assert.equal(text.length, limit);
    assert.equal((await validateJsonlDataset(text, 'openai-chat')).stats.invalid, 0);

    await rejects(
      () => validateJsonlDataset(`${text}\n`, 'openai-chat'),
      'The dataset must be at most 50 MiB.',
    );
  });

  it('rejects an empty dataset', async () => {
    await rejects(() => validateJsonlDataset('', 'auto'), 'The dataset is empty.');
  });

  it('reports lines that are not JSON objects without echoing them', async () => {
    assert.deepEqual(
      await messagesOf([
        '{"secret": tru',
        '[1]',
        `${'['.repeat(70)}${']'.repeat(70)}`,
        '{"messages":"\\ud83d"}',
      ]),
      [
        'Not valid JSON at column 12: Expected an object, array, string, number, true, false or null.',
        'Each line must be a JSON object.',
        'Nesting is limited to 64 levels.',
        'RFC 8785 rejects a string with an unpaired surrogate such as \\ud83d.',
      ],
    );
  });
});

describe('JSONL dataset validator: report', () => {
  it('counts duplicates by canonical JSON', async () => {
    const report = await check([
      '{"messages":[{"role":"user","content":"Hi"},{"role":"assistant","content":"Hello"}]}',
      '{ "messages": [{"content":"Hi","role":"user"},{"content":"Hello","role":"assistant"}] }',
      chat(user('Other'), assistant()),
      chat(user(), assistant()),
    ]);

    assert.equal(report.stats.duplicates, 2);

    assert.deepEqual(
      report.issues.map(({ line, message }) => [line, message]),
      [
        [2, 'Duplicate of line 1.'],
        [4, 'Duplicate of line 1.'],
      ],
    );
  });

  it('does not count repeated invalid lines as duplicates', async () => {
    const report = await check([chat(user()), chat(user())]);

    assert.equal(report.stats.invalid, 2);
    assert.equal(report.stats.duplicates, 0);
  });

  it('collects statistics over valid examples', async () => {
    const report = await check([
      chat({ content: 'Be brief.', role: 'system' }, user('One two'), assistant('Three')),
      chat(user('Hi'), assistant('Hello there')),
      chat(user('no answer')),
    ]);
    const sum = (...texts: string[]) =>
      texts.reduce((total, text) => total + estimateTokens(text), 0);
    const tokens = [sum('Be brief.', 'One two', 'Three'), sum('Hi', 'Hello there')];

    assert.deepEqual(report.stats, {
      duplicates: 0,
      invalid: 1,
      lines: 3,
      messages: { max: 3, median: 2.5, min: 2 },
      roles: { assistant: 2, system: 1, user: 2 },
      tokens: {
        max: Math.max(...tokens),
        median: (tokens[0]! + tokens[1]!) / 2,
        min: Math.min(...tokens),
        total: tokens[0]! + tokens[1]!,
      },
      valid: 2,
    });

    assert.deepEqual(report.issueCount, { errors: 1, warnings: 0 });
  });

  it('shows the first 500 issues and says how many there are', async () => {
    const { report, summary } = formatJsonlReport(
      await validateJsonlDataset('1\n'.repeat(600), 'openai-chat'),
    );
    const rows = report.split('\n');

    assert.equal(rows[0], 'Showing 500 of 600 issues.');
    assert.equal(rows.filter((row) => row.startsWith('Line ')).length, 500);
    assert.equal(summary, 'OpenAI chat · 600 lines · 0 valid · 600 invalid · 600 errors');
  });

  it('puts each issue message under its own line and severity header', async () => {
    const { report } = formatJsonlReport(
      await validateJsonlDataset(
        '1\n{"messages":[{"role":"user","content":"hi"}]}\n',
        'openai-chat',
      ),
    );

    assert.ok(
      report.endsWith(
        '\n\nLine 1 · error\nEach line must be a JSON object.\n\nLine 2 · error\nThere must be at least one assistant message.',
      ),
    );
  });

  it('stops collecting at 10,000 issues and keeps exact counts', async () => {
    const report = await validateJsonlDataset('1\n'.repeat(10_001), 'openai-chat');

    assert.equal(report.issues.length, 10_000);
    assert.deepEqual(report.issueCount, { errors: 10_001, warnings: 0 });
    assert.ok(formatJsonlReport(report).report.startsWith('Showing 500 of 10,001 issues.'));
  });

  it('formats a clean report', async () => {
    const { report, summary } = formatJsonlReport(await check([chat(user(), assistant())]));

    assert.match(report, /^Format: OpenAI chat\nLines: 1 \(1 valid, 0 invalid\)\n/);
    assert.match(report, /\nRoles: assistant 1, user 1\n/);
    assert.ok(report.endsWith('No issues found.'));
    assert.equal(summary, 'OpenAI chat · 1 line · 1 valid · 0 invalid · no issues');
  });
});

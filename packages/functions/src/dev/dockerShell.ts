import { FunctionError } from '../errors';

export function dockerError(message: string): FunctionError {
  return new FunctionError('INVALID_DOCKER_COMMAND', message);
}

export function splitCommand(source: string): string[] {
  if (!source.trim()) throw dockerError('Docker command input is required.');
  if (source.length > 100_000)
    throw dockerError('Docker command is limited to 100,000 UTF-16 units.');
  if (/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]|[\uD800-\uDFFF]/u.test(source))
    throw dockerError('Use valid Unicode without control characters or unpaired surrogates.');

  const state: SplitState = { index: 0, quote: '', started: false, token: '', tokens: [] };

  for (; state.index < source.length; state.index += 1) {
    const character = source.charAt(state.index);

    if (state.quote === "'") readSingleQuoted(state, character);
    else if (character === '\\') readBackslash(state, source);
    else if (state.quote === '"') readDoubleQuoted(state, character);
    else readUnquoted(state, source, character);
  }

  if (state.quote) throw dockerError('An opening quote is not closed.');
  if (state.started) state.tokens.push(state.token);
  if (state.tokens.length > 2048)
    throw dockerError('Docker command is limited to 2,048 arguments.');

  return state.tokens;
}

type SplitState = {
  index: number;
  quote: string;
  started: boolean;
  token: string;
  tokens: string[];
};

function readSingleQuoted(state: SplitState, character: string) {
  if (character === "'") state.quote = '';
  else state.token += character;
}

function readBackslash(state: SplitState, source: string) {
  const next = source[state.index + 1];

  if (next === undefined) throw dockerError('A trailing backslash is incomplete.');
  if (next === '\n' || (next === '\r' && source[state.index + 2] === '\n')) {
    state.index += next === '\r' ? 2 : 1;
  } else if (!state.quote || ['$', '`', '"', '\\'].includes(next)) {
    state.token += next;
    state.started = true;
    state.index += 1;
  } else state.token += '\\';
}

function readDoubleQuoted(state: SplitState, character: string) {
  if (character === '"') state.quote = '';
  else if (character === '$' || character === '`')
    throw dockerError(
      'Host-shell expansion is not evaluated. Single-quote or backslash-escape literal dollar signs and backticks.',
    );
  else state.token += character;
}

function readUnquoted(state: SplitState, source: string, character: string) {
  if (character === "'" || character === '"') {
    state.quote = character;
    state.started = true;
  } else if (character === ' ' || character === '\t' || character === '\n' || character === '\r') {
    if (
      (character === '\n' || character === '\r') &&
      (state.tokens.length || state.started) &&
      source.slice(state.index).trim()
    )
      throw dockerError(
        'Use backslash-newline continuation for a multiline command. Unescaped newlines can start a second shell command.',
      );
    if (state.started) state.tokens.push(state.token);

    state.token = '';
    state.started = false;
  } else {
    if (
      '$`;|&<>()*?{['.includes(character) ||
      (character === '~' && !state.started) ||
      (character === '#' && !state.started)
    )
      throw dockerError(
        'Shell operators, expansion, globbing and comments are unsupported. Quote literal arguments or provide one plain docker run command.',
      );

    state.token += character;
    state.started = true;
  }

  if (state.tokens.length > 2048)
    throw dockerError('Docker command is limited to 2,048 arguments.');
}

import { checkLogInput, logError } from './shared';

// at name (file:line:column), at name file:line, or a nameless at file:line:column frame such as at
// /app/server.js:10:5.
// The nameless form needs a non-digit in its location, so a line such as at 10:30:00 is not a
// frame.
// V8 prints built-ins without a file: at Array.map (<anonymous>) or at Promise.all (index 0).
const NAMELESS_FRAME = /^\s*at\s+(?=\S*[^\s\d:])\S+:\d+:\d+$/;
const ANONYMOUS_FRAME = /^\s*at\s+<anonymous>$/;
const BUILT_IN_LOCATION = / \((?:<anonymous>|native|index \d+)\)$/;
const LINE_TERMINATOR = /[\n\r\u2028\u2029]/;
const FRAME_START = /^\s*at(\s+)/;
const FRAME_LOCATION = /^\S+:\d+(?::\d+)?\)?$/;

const PYTHON_FRAME = /^\s*File "[^"]+", line \d+(?:, in .+)?$/;

export function cleanStackTrace(text: string): string {
  checkLogInput(text);
  const lines = text
    .split(/\r\n?|\n/)
    .map((line) => line.trimEnd())
    .filter((line) => line.trim());
  const javascriptFrames = lines
    .filter((line) => isJavaScriptFrame(line))
    .map((line) => line.trim());
  const pythonFrames = lines.filter((line) => PYTHON_FRAME.test(line)).map((line) => line.trim());
  const supportedFrames = new Set([...javascriptFrames, ...pythonFrames]);
  const frames = dedupeConsecutive(
    lines.map((line) => line.trim()).filter((line) => supportedFrames.has(line)),
  );

  if (!frames.length)
    throw logError('No supported JavaScript, TypeScript, or Python stack frames found.');

  const isPython = pythonFrames.length > 0 && javascriptFrames.length === 0;
  const nonFrameLines = lines.filter(
    (line) =>
      !isJavaScriptFrame(line) &&
      !PYTHON_FRAME.test(line) &&
      !/^Traceback \(most recent call last\):$/.test(line),
  );
  const exception = (isPython ? nonFrameLines.at(-1) : nonFrameLines[0])?.trim() || 'Unknown error';

  return [
    '# Stack Trace',
    '',
    `Exception: ${exception}`,
    `Frames: ${frames.length}`,
    '',
    ...frames.map((frame, index) => `${index + 1}. ${frame}`),
  ].join('\n');
}

function dedupeConsecutive(values: string[]): string[] {
  return values.filter((value, index) => index === 0 || value !== values[index - 1]);
}

// The same as /^\s*at\s+(?:.+(?:\(|\s)\S+:\d+(?::\d+)?\)?|(?=\S*[^\s\d:])\S+:\d+:\d+|
// .+ \((?:<anonymous>|native|index \d+)\)|<anonymous>)$/, without its backtracking over every
// split of a long line.
function isJavaScriptFrame(line: string): boolean {
  return (
    isLocatedFrame(line) ||
    NAMELESS_FRAME.test(line) ||
    isBuiltInFrame(line) ||
    ANONYMOUS_FRAME.test(line)
  );
}

function isBuiltInFrame(line: string): boolean {
  const location = line.search(BUILT_IN_LOCATION);

  return location !== -1 && framePrefixTest(line)?.(location) === true;
}

/**
 * Tests a line against /^\s*at\s+.+(?:\(|\s)\S+:\d+(?::\d+)?\)?$/ in linear time. The location
 * is a space-free tail after whitespace or "(", and a longer tail matches whenever a shorter one
 * does, so only the leftmost such cut whose prefix still reads "at <name>" is tested. Kept in sync
 * with packages/core/src/contextDetection.ts.
 */
function isLocatedFrame(line: string): boolean {
  const isPrefix = framePrefixTest(line);

  if (!isPrefix) return false;

  for (let cut = lastWhitespace(line); cut !== -1; cut = line.indexOf('(', cut + 1)) {
    if (isPrefix(cut)) return FRAME_LOCATION.test(line.slice(cut + 1));
  }

  return false;
}

/** Whether line.slice(0, end) matches /^\s*at\s+.+$/, for any end, in constant time. */
function framePrefixTest(line: string): ((end: number) => boolean) | undefined {
  const start = FRAME_START.exec(line);

  if (!start) return undefined;

  const runEnd = start[0].length;
  const runStart = runEnd - start[1]!.length;
  const terminator = line.slice(runEnd).search(LINE_TERMINATOR);
  const firstTerminator = terminator === -1 ? line.length : runEnd + terminator;

  // Past the whitespace run the name is the rest, which "." must cover; inside it, the name is the
  // run's last character and needs one more whitespace before it.
  return (end) =>
    end > runEnd
      ? end <= firstTerminator
      : end - runStart >= 2 && !LINE_TERMINATOR.test(line.charAt(end - 1));
}

function lastWhitespace(line: string): number {
  let index = line.length - 1;

  while (index >= 0 && !/\s/.test(line.charAt(index))) index -= 1;

  return index;
}

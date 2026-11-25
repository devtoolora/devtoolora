import { checkLogInput, logError } from './shared';

// at name (file:line:column), at name file:line, or a nameless at file:line:column frame such as at
// /app/server.js:10:5.
// The nameless form needs a non-digit in its location, so a line such as at 10:30:00 is not a
// frame.
// V8 prints built-ins without a file: at Array.map (<anonymous>) or at Promise.all (index 0).
const JAVASCRIPT_FRAME =
  /^\s*at\s+(?:.+(?:\(|\s)\S+:\d+(?::\d+)?\)?|(?=\S*[^\s\d:])\S+:\d+:\d+|.+ \((?:<anonymous>|native|index \d+)\)|<anonymous>)$/;

const PYTHON_FRAME = /^\s*File "[^"]+", line \d+(?:, in .+)?$/;

export function cleanStackTrace(text: string): string {
  checkLogInput(text);
  const lines = text
    .split(/\r\n?|\n/)
    .map((line) => line.trimEnd())
    .filter((line) => line.trim());
  const javascriptFrames = lines
    .filter((line) => JAVASCRIPT_FRAME.test(line))
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
      !JAVASCRIPT_FRAME.test(line) &&
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

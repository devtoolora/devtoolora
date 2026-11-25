import { FunctionError } from '../errors';

export type LineCleanupOptions = {
  blankLines: 'collapse' | 'keep' | 'remove';
  lineNumbers: 'keep' | 'remove';
  whitespaceIsBlank: boolean;
};
export type LineCleanupResult = {
  blankLinesRemoved: number;
  numbersRemoved: number;
  text: string;
};

const maxUnits = 1_000_000;
const physicalLine = /[^\r\n]*(?:\r\n|\n|\r)|[^\r\n]+$/g;
const terminatorAtEnd = /(?:\r\n|\n|\r)$/;
// A delimiter must be followed by a space, tab or line end, so 3.14, 10:30 and 1|2 stay intact.
const numberPrefix = /^[ \t]*\d{1,9}(?:(?:[.):]|[ \t]*\|)(?=[ \t]|$)[ \t]?|\t)/;
// A bare number is an editor copy of a numbered blank line whose trailing space was trimmed.
const spaceNumberPrefix = /^[ \t]*\d{1,9}(?:[ \t]*$| )/;
const spaceNumberedText = /^[ \t]*\d{1,9} \S/;

function splitContent(line: string): { content: string; terminator: string } {
  const terminator = terminatorAtEnd.exec(line)?.[0] ?? '';

  return { content: line.slice(0, line.length - terminator.length), terminator };
}

// Editor copies number every filled line with a bare space and count up by one, e.g. "12 const a".
// One line, or numbers that do not count up, are ordinary text such as "2024 was good".
function isSpaceNumbered(filled: string[]): boolean {
  return (
    filled.length > 1 &&
    filled.some((line) => spaceNumberedText.test(line)) &&
    filled.every(
      (line, index) =>
        spaceNumberPrefix.test(line) &&
        (index === 0 || parseInt(line, 10) === parseInt(filled[index - 1] ?? '', 10) + 1),
    )
  );
}

export function cleanLines(text: string, options: LineCleanupOptions): LineCleanupResult {
  if (text.length > maxUnits)
    throw new FunctionError('INVALID_TEXT', 'Input is limited to 1,000,000 characters.');

  const lines = (text.match(physicalLine) ?? []).map(splitContent);
  const spaceForm = isSpaceNumbered(
    lines.map(({ content }) => content).filter((content) => !/^[ \t]*$/.test(content)),
  );
  const kept: string[] = [];
  let blankLinesRemoved = 0;
  let numbersRemoved = 0;
  let previousBlank = false;

  for (const line of lines) {
    let { content } = line;

    if (options.lineNumbers === 'remove') {
      const stripped = content.replace(
        numberPrefix.test(content) || !spaceForm ? numberPrefix : spaceNumberPrefix,
        '',
      );

      if (stripped !== content) numbersRemoved += 1;

      content = stripped;
    }

    const blank = options.whitespaceIsBlank ? /^[ \t]*$/.test(content) : content === '';
    const drop =
      blank &&
      (options.blankLines === 'remove' || (options.blankLines === 'collapse' && previousBlank));

    previousBlank = blank;

    if (drop) blankLinesRemoved += 1;
    else kept.push(content + line.terminator);
  }

  return { blankLinesRemoved, numbersRemoved, text: kept.join('') };
}

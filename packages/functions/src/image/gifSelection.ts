import { imageError } from './formats';

export function missingFrame(frame: string, frameCount: number): Error {
  const count = `${frameCount.toLocaleString('en-US')} frame${frameCount === 1 ? '' : 's'}`;

  return imageError(`Frame ${frame} does not exist; the GIF has ${count}.`);
}

export function parseFrameSelection(text: string, frameCount: number): number[] {
  const all = Array.from({ length: frameCount }, (_, index) => index + 1);

  if (text.trim() === '') return all;

  const marks = new Int32Array(frameCount + 2);

  for (const part of text.split(',')) {
    const bounds = part.split('-').map((bound) => bound.trim());

    if (bounds.length > 2 || !bounds.every((bound) => /^\d+$/.test(bound)))
      throw imageError('Frames must be numbers or ranges like 1-10,15.');

    const [from = 0, to = from] = bounds.map(Number);
    const outside = bounds.find((bound) => Number(bound) < 1 || Number(bound) > frameCount);

    if (outside !== undefined) throw missingFrame(outside, frameCount);
    if (to < from) throw imageError('Frames must be numbers or ranges like 1-10,15.');

    marks[from] = (marks[from] ?? 0) + 1;
    marks[to + 1] = (marks[to + 1] ?? 0) - 1;
  }

  let depth = 0;

  return all.filter((frame) => {
    depth += marks[frame] ?? 0;

    return depth > 0;
  });
}

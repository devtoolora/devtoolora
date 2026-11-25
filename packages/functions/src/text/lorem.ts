import { FunctionError } from '../errors';

export type LoremOptions = {
  sentencesPerParagraph?: number;
  startWithLorem?: boolean;
  unit?: 'paragraphs' | 'sentences' | 'words';
};

export type LoremResult = {
  paragraphs: string[];
  sentences: number;
  text: string;
  words: number;
};

const SENTENCES = [
  'Lorem ipsum dolor sit amet, consectetur adipiscing elit.',
  'Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.',
  'Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris.',
  'Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore.',
  'Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim.',
  'Integer vitae justo sed neque luctus dictum.',
  'Donec facilisis, arcu non blandit tempor, risus sem gravida justo.',
  'Vivamus tincidunt sapien vitae lectus luctus, id aliquet sapien interdum.',
  'Praesent consequat eros at augue posuere, vitae pharetra mauris pretium.',
  'Curabitur vel libero sit amet sapien tincidunt interdum.',
  'Morbi malesuada massa sed orci posuere, vel commodo sem pulvinar.',
  'Nam dignissim tellus eu nibh posuere, non tincidunt nulla vulputate.',
  'Aliquam erat volutpat, posuere at nibh nec, viverra tristique erat.',
  'Nulla facilisi, vestibulum vitae lacus vitae, pretium porttitor quam.',
  'Fusce finibus nibh vitae massa placerat, a interdum justo fermentum.',
  'Pellentesque habitant morbi tristique senectus et netus et malesuada fames.',
  'Aenean posuere ligula in tellus dictum, vitae ultrices sapien interdum.',
  'Maecenas ultrices justo ac orci eleifend, vitae placerat nibh consectetur.',
  'Suspendisse potenti, feugiat sed mi quis, consequat aliquam mauris.',
  'Quisque vitae nibh eu lectus sagittis suscipit vitae vitae urna.',
];

function validateCount(count: number, maximum: number, label: string): void {
  if (!Number.isInteger(count) || count < 1 || count > maximum) {
    throw new FunctionError(
      'INVALID_TEXT',
      `${label} must be a whole number from 1 to ${maximum.toLocaleString('en-US')}.`,
    );
  }
}

const maximumCounts = { paragraphs: 50, sentences: 100, words: 5000 };

export function generateLoremIpsum(count: number, options: LoremOptions = {}): LoremResult {
  const unit = options.unit ?? 'sentences';

  if (unit !== 'words' && unit !== 'sentences' && unit !== 'paragraphs') {
    throw new FunctionError('INVALID_TEXT', 'Choose words, sentences or paragraphs.');
  }

  validateCount(count, maximumCounts[unit], 'Amount');
  const startWithLorem = options.startWithLorem ?? true;

  if (typeof startWithLorem !== 'boolean')
    throw new FunctionError('INVALID_TEXT', 'Start with Lorem ipsum must be boolean.');

  const sentencesPerParagraph = unit === 'words' ? 5 : (options.sentencesPerParagraph ?? 5);

  if (unit !== 'words') validateCount(sentencesPerParagraph, 10, 'Sentences per paragraph');

  const offset = startWithLorem ? 0 : 1;
  const paragraphs: string[] = [];

  if (unit === 'words') {
    const pool = [...SENTENCES.slice(offset), ...SENTENCES.slice(0, offset)].join(' ').split(' ');

    paragraphs.push(
      Array.from({ length: count }, (_, index) => pool[index % pool.length]).join(' '),
    );
  } else {
    const sentenceCount = unit === 'paragraphs' ? count * sentencesPerParagraph : count;

    for (let index = 0; index < sentenceCount; index += sentencesPerParagraph) {
      paragraphs.push(
        Array.from(
          { length: Math.min(sentencesPerParagraph, sentenceCount - index) },
          (_, position) => SENTENCES[(offset + index + position) % SENTENCES.length],
        ).join(' '),
      );
    }
  }

  const text = paragraphs.join('\n\n');

  return {
    paragraphs,
    sentences: text.match(/\./g)?.length ?? 0,
    text,
    words: text.split(/\s+/).length,
  };
}

export function loremIpsum(sentences: number): string {
  return generateLoremIpsum(sentences).text;
}

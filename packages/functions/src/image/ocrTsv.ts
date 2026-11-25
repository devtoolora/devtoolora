export type OcrItem = {
  bbox: { height: number; width: number; x: number; y: number };
  confidence: number;
  text: string;
};

export type OcrReport = {
  language: string;
  lines: OcrItem[];
  meanConfidence: number;
  words: OcrItem[];
};

const mean = (values: number[]): number =>
  values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length;

export function parseTesseractTsv(tsv: string, scale: number): Pick<OcrReport, 'lines' | 'words'> {
  const groups = new Map<string, OcrItem[]>();
  const words: OcrItem[] = [];

  for (const row of tsv.split('\n')) {
    const cells = row.replace(/\r$/, '').split('\t');
    const text = cells[11]?.trim();

    if (cells[0] !== '5' || !text) continue;

    const [left, top, width, height] = cells.slice(6, 10).map((cell) => Number(cell) / scale);
    const word = {
      bbox: {
        height: Math.round(height!),
        width: Math.round(width!),
        x: Math.round(left!),
        y: Math.round(top!),
      },
      confidence: Number(cells[10]),
      text,
    };
    const key = cells.slice(2, 5).join('.');

    words.push(word);
    groups.set(key, [...(groups.get(key) ?? []), word]);
  }

  const lines = [...groups.values()].map((group) => {
    const x = Math.min(...group.map((word) => word.bbox.x));
    const y = Math.min(...group.map((word) => word.bbox.y));

    return {
      bbox: {
        height: Math.max(...group.map((word) => word.bbox.y + word.bbox.height)) - y,
        width: Math.max(...group.map((word) => word.bbox.x + word.bbox.width)) - x,
        x,
        y,
      },
      confidence: mean(group.map((word) => word.confidence)),
      text: group.map((word) => word.text).join(' '),
    };
  });

  return { lines, words };
}

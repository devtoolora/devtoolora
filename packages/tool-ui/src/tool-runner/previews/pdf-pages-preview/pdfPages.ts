import { parsePageSelection } from '@devtoolora/functions/pdf';
import type { PickedToolFile } from '../../types';

export type PdfSource = { data: string; name: string };

export const pageLimit = 200;

export const partColors = 3;

export function range(start: number, end: number): number[] {
  return Array.from({ length: Math.max(0, end - start + 1) }, (_, index) => start + index);
}

export function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function pdfSources(value: string, names: string): PdfSource[] {
  if (!value) return [];
  if (value.startsWith('data:')) return [{ data: value, name: names || 'document.pdf' }];

  try {
    const parsed: unknown = JSON.parse(value);

    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter(
        (entry): entry is PickedToolFile =>
          typeof entry?.data === 'string' && typeof entry?.name === 'string',
      )
      .map(({ data, name }) => ({ data, name }));
  } catch {
    return [];
  }
}

export function sourceKeys(sources: PdfSource[]): string[] {
  const seen = new Map<string, number>();

  return sources.map((source) => {
    const key = `${source.name}:${source.data.length}:${source.data.slice(-24)}`;
    const count = (seen.get(key) ?? 0) + 1;

    seen.set(key, count);

    return `${key}:${count}`;
  });
}

function pagesText(count: number): string {
  return `${count} ${count === 1 ? 'page' : 'pages'}`;
}

export function pageCountLabel(count: number, loading: boolean): string {
  if (count) return pagesText(count);

  return loading ? 'Reading pages…' : '';
}

export function mergeFileStatus(pageCount: number | undefined, failed: boolean): string {
  if (pageCount) return pagesText(pageCount);

  return failed ? 'Cannot preview' : 'Reading…';
}

// PDF rotation is clockwise, so 270° reads as a quarter turn left.
export function rotationLabel(angle: number): string {
  if (angle === 270) return '90° left';
  if (angle === 180) return '180°';

  return '90° right';
}

export function readFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.addEventListener('load', () => resolve(String(reader.result ?? '')));
    reader.addEventListener('error', () => reject(reader.error));
    reader.readAsDataURL(file);
  });
}

export function moved<T>(items: T[], from: number, to: number): T[] {
  const next = [...items];
  const removed = next.splice(from, 1);

  next.splice(to, 0, ...removed);

  return next;
}

export function parseOrder(value: string, count: number): { error: string; order: number[] } {
  if (!value.trim()) return { error: '', order: range(1, count) };

  try {
    return { error: '', order: parsePageSelection(value, count, { ordered: true }) };
  } catch (failure) {
    return { error: errorText(failure), order: range(1, count) };
  }
}

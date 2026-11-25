import { formatPageSelection, splitPdfGroups, type PdfSplitMode } from '@devtoolora/functions/pdf';
import { type ReactElement } from 'react';
import { type PdfThumbnail } from './pdfThumbnails';
import styles from './PdfPagesPreview.module.scss';
import { PageTile } from './PageGrid';
import { errorText, partColors, range } from './pdfPages';

type SplitPagesProps = {
  byPage: Map<number, PdfThumbnail>;
  count: number;
  fields: Record<string, string>;
  visible: number[];
};

export function SplitPages({ byPage, count, fields, visible }: SplitPagesProps): ReactElement {
  const splitMode = (fields.splitMode || 'each') as PdfSplitMode;
  let groups: number[][] = [];
  let error = '';

  try {
    groups = splitPdfGroups(
      splitMode,
      splitMode === 'every' ? fields.splitEvery || '2' : (fields.splitRanges ?? ''),
      count,
    );
  } catch (failure) {
    error = errorText(failure);
  }

  const parts = new Map<number, number[]>();

  groups.forEach((group, index) => {
    for (const page of group) parts.set(page, [...(parts.get(page) ?? []), index + 1]);
  });

  const skipped = range(1, count).filter((page) => !parts.has(page));

  return (
    <>
      <p>Each color is one output file in the ZIP.</p>
      {error && <p className={styles.notice}>{error}</p>}
      <ol className={styles.grid}>
        {visible.map((page) => {
          const files = parts.get(page);
          const firstFile = files?.[0];

          return (
            <li key={page}>
              <PageTile
                badge={files ? `File ${files.join(', ')}` : 'Not exported'}
                dimmed={!files}
                label={
                  files ? `Page ${page}, file ${files.join(', ')}` : `Page ${page}, not exported`
                }
                page={page}
                part={firstFile === undefined ? undefined : (firstFile - 1) % partColors}
                thumbnail={byPage.get(page)}
              />
            </li>
          );
        })}
      </ol>
      {!error && (
        <p className={styles.summary} role="status">
          {groups.length} {groups.length === 1 ? 'file' : 'files'}
          {skipped.length > 0 &&
            `; ${skipped.length === 1 ? 'page' : 'pages'} ${formatPageSelection(skipped)} ${skipped.length === 1 ? 'is' : 'are'} not in any range`}
          .
        </p>
      )}
    </>
  );
}

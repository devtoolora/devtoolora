import { useMemo, type ReactElement } from 'react';
import { usePdfThumbnails } from './pdfThumbnails';
import styles from './PdfPagesPreview.module.scss';
import { type PdfSource } from './pdfPages';

export function StampPreview({
  resultPdf,
  source,
}: {
  resultPdf?: string;
  source: PdfSource;
}): ReactElement {
  const resultData = useMemo(
    () => (resultPdf ? `data:application/pdf;base64,${resultPdf}` : undefined),
    [resultPdf],
  );
  const result = usePdfThumbnails(resultData, { keepPrevious: true, limit: 4, width: 320 });
  const original = usePdfThumbnails(result.pages.length ? undefined : source.data, {
    limit: 4,
    width: 320,
  });
  const shown = result.pages.length ? result : original;
  let label = 'Reading pages…';

  if (result.pages.length)
    label = `First ${shown.pages.length} of ${result.pageCount} pages${result.stale ? ' · updating' : ''}`;
  else if (shown.pages.length) label = 'Original pages, before stamping';

  return (
    <section
      aria-busy={result.stale || result.status === 'loading'}
      aria-label="Stamped page preview"
      className={styles.preview}
    >
      <header>
        <strong>Page preview</strong>
        <span>{label}</span>
      </header>
      {shown.error && <p className={styles.notice}>{shown.error}</p>}
      <ol className={styles.stampPages} data-stale={result.stale}>
        {shown.pages.map((thumbnail) => (
          <li key={thumbnail.url}>
            <img
              alt={`Page ${thumbnail.page}${result.pages.length ? ' with the header, footer and watermark' : ''}`}
              src={thumbnail.url}
            />
          </li>
        ))}
      </ol>
    </section>
  );
}

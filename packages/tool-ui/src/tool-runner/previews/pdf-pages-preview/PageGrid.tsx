import { pageSizeLabel } from '@devtoolora/functions/pdf';
import { type ReactElement } from 'react';
import { usePdfThumbnails, type PdfThumbnail } from './pdfThumbnails';
import styles from './PdfPagesPreview.module.scss';
import { OrderPages } from './OrderPages';
import { SelectPages } from './SelectPages';
import { SplitPages } from './SplitPages';
import { pageCountLabel, pageLimit, type PdfSource, range } from './pdfPages';

type PageTileProps = {
  badge?: string;
  dimmed?: boolean;
  label: string;
  page: number;
  part?: number;
  pressed?: boolean;
  rotation?: number;
  thumbnail?: PdfThumbnail;
  tone?: 'danger' | 'signal';
  onToggle?(extend: boolean): void;
};

export function PageTile({
  badge,
  dimmed,
  label,
  page,
  part,
  pressed,
  rotation,
  thumbnail,
  tone,
  onToggle,
}: PageTileProps): ReactElement {
  const content = (
    <>
      <span className={styles.sheet}>
        {thumbnail ? (
          <img alt="" draggable={false} src={thumbnail.url} />
        ) : (
          <span aria-hidden="true" className={styles.blank} />
        )}
      </span>
      <span className={styles.caption}>
        <span>{page}</span>
        {badge && <em>{badge}</em>}
      </span>
    </>
  );
  const title = thumbnail ? pageSizeLabel(thumbnail.width, thumbnail.height) : undefined;

  if (!onToggle) {
    return (
      <div
        aria-label={label}
        className={styles.tile}
        data-dimmed={dimmed}
        data-part={part}
        data-rotation={rotation}
        data-tone={tone}
        role="img"
        title={title}
      >
        {content}
      </div>
    );
  }

  return (
    <button
      aria-label={label}
      aria-pressed={pressed}
      className={styles.tile}
      data-dimmed={dimmed}
      data-rotation={rotation}
      data-tone={tone}
      title={title}
      type="button"
      onClick={(event) => onToggle(event.shiftKey)}
    >
      {content}
    </button>
  );
}

type PageGridProps = {
  fields: Record<string, string>;
  fileCount: number;
  mode: string;
  source: PdfSource;
  onFieldChange(fieldId: string, value: string): void;
};

type PageGridBodyProps = {
  byPage: Map<number, PdfThumbnail>;
  count: number;
  fields: Record<string, string>;
  mode: string;
  onFieldChange(fieldId: string, value: string): void;
};

function PageGridBody({
  byPage,
  count,
  fields,
  mode,
  onFieldChange,
}: PageGridBodyProps): ReactElement | undefined {
  const visible = range(1, Math.min(count, pageLimit));

  if (!count) return undefined;

  if (mode === 'delete' || mode === 'extract' || mode === 'rotate')
    return (
      <SelectPages
        byPage={byPage}
        count={count}
        fields={fields}
        mode={mode}
        visible={visible}
        onFieldChange={onFieldChange}
      />
    );

  if (mode === 'reorder')
    return (
      <OrderPages
        byPage={byPage}
        count={count}
        value={fields.order ?? ''}
        onFieldChange={onFieldChange}
      />
    );

  if (mode === 'split')
    return <SplitPages byPage={byPage} count={count} fields={fields} visible={visible} />;

  return (
    <ol className={styles.grid}>
      {visible.map((page) => (
        <li key={page}>
          <PageTile label={`Page ${page}`} page={page} thumbnail={byPage.get(page)} />
        </li>
      ))}
    </ol>
  );
}

export function PageGrid({
  fields,
  fileCount,
  mode,
  source,
  onFieldChange,
}: PageGridProps): ReactElement {
  const thumbnails = usePdfThumbnails(source.data, { limit: pageLimit, width: 112 });
  const count = thumbnails.pageCount;
  const byPage = new Map(thumbnails.pages.map((thumbnail) => [thumbnail.page, thumbnail]));
  const note =
    fileCount > 1 &&
    (mode === 'info'
      ? `Previewing ${source.name}; the details cover all ${fileCount} files.`
      : `Only the first file, ${source.name}, is used. Choose Merge to combine files.`);

  return (
    <section
      aria-busy={thumbnails.status === 'loading'}
      aria-label="PDF pages"
      className={styles.preview}
    >
      <header>
        <strong>{source.name}</strong>
        <span>{pageCountLabel(count, thumbnails.status === 'loading')}</span>
      </header>
      {note && <p>{note}</p>}
      {thumbnails.error && <p className={styles.notice}>{thumbnails.error}</p>}
      <PageGridBody
        byPage={byPage}
        count={count}
        fields={fields}
        mode={mode}
        onFieldChange={onFieldChange}
      />
      {count > pageLimit && (
        <p>Showing the first {pageLimit} pages. Type page numbers to reach the rest.</p>
      )}
    </section>
  );
}

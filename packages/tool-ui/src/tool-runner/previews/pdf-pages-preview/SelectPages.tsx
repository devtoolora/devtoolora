import { formatPageSelection, parsePageSelection } from '@devtoolora/functions/pdf';
import { useRef, type ReactElement } from 'react';
import { Button } from '../../../ui';
import { type PdfThumbnail } from './pdfThumbnails';
import styles from './PdfPagesPreview.module.scss';
import { PageTile } from './PageGrid';
import { errorText, range, rotationLabel } from './pdfPages';

type SelectPagesProps = {
  byPage: Map<number, PdfThumbnail>;
  count: number;
  fields: Record<string, string>;
  mode: 'delete' | 'extract' | 'rotate';
  visible: number[];
  onFieldChange(fieldId: string, value: string): void;
};

type PageSelection = {
  angle: number;
  error: string;
  handleToggle(page: number, extend: boolean): void;
  selected: Set<number>;
  write(pages: Set<number>): void;
};

function usePageSelection({
  count,
  fields,
  mode,
  onFieldChange,
}: Pick<SelectPagesProps, 'count' | 'fields' | 'mode' | 'onFieldChange'>): PageSelection {
  const anchor = useRef<number | undefined>(undefined);
  const fieldId = mode === 'rotate' ? 'rotatePages' : 'pages';
  const value = (fields[fieldId] ?? '').trim() || (mode === 'rotate' ? 'all' : '');
  let selected = new Set<number>();
  let error = '';

  if (value) {
    try {
      selected = new Set(parsePageSelection(value, count));
    } catch (failure) {
      error = errorText(failure);
    }
  }

  const write = (pages: Set<number>) =>
    onFieldChange(
      fieldId,
      mode === 'rotate' && pages.size === count ? 'all' : formatPageSelection([...pages]),
    );

  const handleToggle = (page: number, extend: boolean) => {
    const next = new Set(selected);

    if (extend && anchor.current !== undefined) {
      for (const number of range(Math.min(anchor.current, page), Math.max(anchor.current, page)))
        next.add(number);
    } else if (next.has(page)) next.delete(page);
    else next.add(page);

    anchor.current = page;
    write(next);
  };

  return { angle: Number(fields.angle || '90'), error, handleToggle, selected, write };
}

type SelectActionsProps = {
  count: number;
  selection: PageSelection;
};

function SelectActions({ count, selection }: SelectActionsProps): ReactElement {
  const { selected, write } = selection;

  return (
    <div className={styles.actions}>
      <Button size="sm" variant="ghost" onClick={() => write(new Set(range(1, count)))}>
        Select all
      </Button>
      <Button
        size="sm"
        variant="ghost"
        onClick={() => write(new Set(range(1, count).filter((page) => !selected.has(page))))}
      >
        Invert
      </Button>
      <Button disabled={!selected.size} size="sm" variant="ghost" onClick={() => write(new Set())}>
        Clear
      </Button>
    </div>
  );
}

export function SelectPages({
  byPage,
  count,
  fields,
  mode,
  visible,
  onFieldChange,
}: SelectPagesProps): ReactElement {
  const selection = usePageSelection({ count, fields, mode, onFieldChange });
  const { angle, selected } = selection;
  const verb = { delete: 'delete', extract: 'keep', rotate: 'rotate' }[mode];
  const summary = {
    delete: `${selected.size} of ${count} pages will be deleted.`,
    extract: `${selected.size} of ${count} pages go into the new PDF.`,
    rotate: `${selected.size} of ${count} pages turn ${rotationLabel(angle)}.`,
  }[mode];
  const selectedBadge = { delete: 'Delete', extract: 'Keep', rotate: `${angle}°` }[mode];
  const selectedTone = mode === 'delete' ? 'danger' : 'signal';

  return (
    <>
      <p>
        Click pages to {verb} them; Shift-click selects a range. The page field updates as you
        click.
      </p>
      <SelectActions count={count} selection={selection} />
      {selection.error && <p className={styles.notice}>{selection.error}</p>}
      <ol className={styles.grid}>
        {visible.map((page) => {
          const isSelected = selected.has(page);

          return (
            <li key={page}>
              <PageTile
                badge={isSelected ? selectedBadge : undefined}
                dimmed={mode === 'extract' ? !isSelected : mode === 'delete' && isSelected}
                label={`Page ${page}`}
                page={page}
                pressed={isSelected}
                rotation={mode === 'rotate' && isSelected ? angle : undefined}
                thumbnail={byPage.get(page)}
                tone={isSelected ? selectedTone : undefined}
                onToggle={(extend) => selection.handleToggle(page, extend)}
              />
            </li>
          );
        })}
      </ol>
      <p className={styles.summary} role="status">
        {summary}
      </p>
    </>
  );
}

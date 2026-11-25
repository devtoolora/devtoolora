import { formatPageOrder, formatPageSelection } from '@devtoolora/functions/pdf';
import { ArrowLeft, ArrowRight, X } from 'lucide-react';
import { useState, type DragEvent, type ReactElement } from 'react';
import { Button } from '../../../ui';
import { type PdfThumbnail } from './pdfThumbnails';
import styles from './PdfPagesPreview.module.scss';
import { PageTile } from './PageGrid';
import { moved, pageLimit, parseOrder, range } from './pdfPages';
import { useMoveFocus } from './useMoveFocus';

type DragReorder = {
  handleDragEnd(): void;
  handleDragOver(event: DragEvent, index: number): void;
  handleDragStart(index: number): void;
  handleDrop(event: DragEvent, index: number): void;
  isDropTarget(index: number): boolean;
};

export function useDragReorder(onReorder: (from: number, to: number) => void): DragReorder {
  const [dragIndex, setDragIndex] = useState<number | undefined>(undefined);
  const [dropIndex, setDropIndex] = useState<number | undefined>(undefined);

  const handleDragEnd = () => {
    setDragIndex(undefined);
    setDropIndex(undefined);
  };

  const handleDragOver = (event: DragEvent, index: number) => {
    if (dragIndex === undefined) return;

    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    setDropIndex(index);
  };

  const handleDrop = (event: DragEvent, index: number) => {
    event.preventDefault();
    if (dragIndex !== undefined && dragIndex !== index) onReorder(dragIndex, index);

    setDragIndex(undefined);
    setDropIndex(undefined);
  };

  return {
    handleDragEnd,
    handleDragOver,
    handleDragStart: (index) => setDragIndex(index),
    handleDrop,
    isDropTarget: (index) => dropIndex === index && dragIndex !== index,
  };
}

type OmittedPagesProps = {
  byPage: Map<number, PdfThumbnail>;
  pages: number[];
  onAdd(page: number): void;
};

function OmittedPages({ byPage, pages, onAdd }: OmittedPagesProps): ReactElement {
  return (
    <>
      <p>Left out: {formatPageSelection(pages)}. Click a page to add it back at the end.</p>
      <ol className={styles.grid}>
        {pages
          .filter((page) => page <= pageLimit)
          .map((page) => (
            <li key={page}>
              <PageTile
                dimmed
                label={`Add page ${page} back`}
                page={page}
                thumbnail={byPage.get(page)}
                onToggle={() => onAdd(page)}
              />
            </li>
          ))}
      </ol>
    </>
  );
}

type OrderPagesProps = {
  byPage: Map<number, PdfThumbnail>;
  count: number;
  value: string;
  onFieldChange(fieldId: string, value: string): void;
};

type OrderTileProps = {
  drag: DragReorder;
  index: number;
  order: number[];
  page: number;
  thumbnail?: PdfThumbnail;
  onMove(to: number): void;
  onOrderChange(pages: number[]): void;
};

function OrderTile({
  drag,
  index,
  order,
  page,
  thumbnail,
  onMove,
  onOrderChange,
}: OrderTileProps): ReactElement {
  return (
    <li
      data-drop={drag.isDropTarget(index)}
      draggable
      onDragEnd={drag.handleDragEnd}
      onDragOver={(event) => drag.handleDragOver(event, index)}
      onDragStart={(event) => {
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', String(page));
        drag.handleDragStart(index);
      }}
      onDrop={(event) => drag.handleDrop(event, index)}
    >
      <PageTile
        badge={`#${index + 1}`}
        label={`Page ${page}, position ${index + 1}`}
        page={page}
        thumbnail={thumbnail}
      />
      <span className={styles.tileActions}>
        <button
          aria-label={`Move page ${page} earlier`}
          data-move="earlier"
          disabled={index === 0}
          type="button"
          onClick={() => onMove(index - 1)}
        >
          <ArrowLeft size={13} />
        </button>
        <button
          aria-label={`Move page ${page} later`}
          data-move="later"
          disabled={index === order.length - 1}
          type="button"
          onClick={() => onMove(index + 1)}
        >
          <ArrowRight size={13} />
        </button>
        <button
          aria-label={`Leave out page ${page}`}
          disabled={order.length === 1}
          type="button"
          onClick={() => onOrderChange(order.filter((_, position) => position !== index))}
        >
          <X size={13} />
        </button>
      </span>
    </li>
  );
}

export function OrderPages({ byPage, count, value, onFieldChange }: OrderPagesProps): ReactElement {
  const { error, order } = parseOrder(value, count);
  const omitted = range(1, count).filter((page) => !order.includes(page));
  const write = (pages: number[]) => onFieldChange('order', formatPageOrder(pages));
  const drag = useDragReorder((from, to) => write(moved(order, from, to)));
  const focus = useMoveFocus(value);

  return (
    <>
      <p>
        Drag pages into the new order, or use the arrow buttons. Pages you leave out are dropped
        from the result.
      </p>
      <div className={styles.actions}>
        <Button size="sm" variant="ghost" onClick={() => write([...order].reverse())}>
          Reverse
        </Button>
        <Button size="sm" variant="ghost" onClick={() => write(range(1, count))}>
          Reset
        </Button>
      </div>
      {error && <p className={styles.notice}>{error}</p>}
      <ol className={styles.grid} ref={focus.listRef}>
        {order.slice(0, pageLimit).map((page, index) => (
          <OrderTile
            drag={drag}
            index={index}
            key={`${index}-${page}`}
            order={order}
            page={page}
            thumbnail={byPage.get(page)}
            onMove={(to) => {
              focus.onMoved(to, to < index ? 'earlier' : 'later');
              write(moved(order, index, to));
            }}
            onOrderChange={write}
          />
        ))}
      </ol>
      {omitted.length > 0 && (
        <OmittedPages byPage={byPage} pages={omitted} onAdd={(page) => write([...order, page])} />
      )}
      <p className={styles.summary} role="status">
        New order: {formatPageOrder(order)}.
      </p>
    </>
  );
}

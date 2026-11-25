import { ArrowDown, ArrowUp, Plus, X } from 'lucide-react';
import { useRef, useState, type DragEvent, type ReactElement, type RefObject } from 'react';
import { Button } from '../../../ui';
import { bytesText } from '../../utils/bytesText';
import { dataUriByteLength } from '../../utils/dataUri';
import { usePdfThumbnails } from './pdfThumbnails';
import type { FileToolField, ToolPlatformActions } from '../../types';
import styles from './PdfPagesPreview.module.scss';
import { useDragReorder } from './OrderPages';
import { useMoveFocus } from './useMoveFocus';
import {
  errorText,
  mergeFileStatus,
  moved,
  type PdfSource,
  readFile,
  sourceKeys,
} from './pdfPages';

function writeMergeSources(
  next: PdfSource[],
  onFieldChange: (fieldId: string, value: string) => void,
): void {
  onFieldChange(
    'pdfs',
    next.length ? JSON.stringify(next.map(({ data, name }) => ({ data, name }))) : '',
  );

  onFieldChange('pdfsName', next.map((source) => source.name).join(', '));
}

type MergeListProps = {
  field?: FileToolField;
  platformActions?: ToolPlatformActions;
  sources: PdfSource[];
  onFieldChange(fieldId: string, value: string): void;
};

type MergeAddFiles = {
  error: string;
  handleAdd(): Promise<void>;
  handleFiles(list: FileList | null): Promise<void>;
  input: RefObject<HTMLInputElement | null>;
};

function useMergeAddFiles(
  {
    field,
    platformActions,
    sources,
  }: Pick<MergeListProps, 'field' | 'platformActions' | 'sources'>,
  write: (next: PdfSource[]) => void,
): MergeAddFiles {
  const input = useRef<HTMLInputElement>(null);
  const [error, setError] = useState('');

  const handleFiles = async (list: FileList | null) => {
    const files = [...(list ?? [])];

    if (!files.length) return;

    setError('');
    const maxBytes = field?.maxBytes;

    if (maxBytes && files.some((file) => file.size > maxBytes)) {
      setError(`Each PDF must be at most ${bytesText(maxBytes)}.`);

      return;
    }

    try {
      write([
        ...sources,
        ...(await Promise.all(
          files.map(async (file) => ({ data: await readFile(file), name: file.name })),
        )),
      ]);
    } catch (failure) {
      setError(errorText(failure));
    }
  };

  const handleAdd = async () => {
    if (!platformActions?.pickFiles || !field) {
      input.current?.click();

      return;
    }

    try {
      const files = await platformActions.pickFiles(field);

      if (files) write([...sources, ...files]);
    } catch {
      input.current?.click();
    }
  };

  return { error, handleAdd, handleFiles, input };
}

type PdfFileInputProps = {
  inputRef: RefObject<HTMLInputElement | null>;
  onFiles(list: FileList | null): Promise<void>;
};

function PdfFileInput({ inputRef, onFiles }: PdfFileInputProps): ReactElement {
  return (
    <input
      accept="application/pdf,.pdf"
      aria-label="Add PDF files"
      className={styles.hiddenInput}
      multiple
      ref={inputRef}
      tabIndex={-1}
      type="file"
      onChange={(event) => {
        void onFiles(event.target.files);
        event.target.value = '';
      }}
    />
  );
}

export function MergeList({
  field,
  platformActions,
  sources,
  onFieldChange,
}: MergeListProps): ReactElement {
  const write = (next: PdfSource[]) => writeMergeSources(next, onFieldChange);
  const drag = useDragReorder((from, to) => write(moved(sources, from, to)));
  const add = useMergeAddFiles({ field, platformActions, sources }, write);
  const keys = sourceKeys(sources);
  const focus = useMoveFocus(keys.join());

  return (
    <section aria-label="Files to merge" className={styles.preview}>
      <header>
        <strong>Merge order</strong>
        <span>
          {sources.length} {sources.length === 1 ? 'file' : 'files'}
        </span>
      </header>
      <p>
        Drag files or use the arrows to set the order. The merged PDF keeps the first file's title
        and author.
      </p>
      <ol className={styles.files} ref={focus.listRef}>
        {sources.map((source, index) => (
          <MergeCard
            dropTarget={drag.isDropTarget(index)}
            index={index}
            isLast={index === sources.length - 1}
            key={keys[index]}
            source={source}
            onDragEnd={drag.handleDragEnd}
            onDragOver={(event) => drag.handleDragOver(event, index)}
            onDragStart={() => drag.handleDragStart(index)}
            onDrop={(event) => drag.handleDrop(event, index)}
            onMove={(to) => {
              focus.onMoved(to, to < index ? 'earlier' : 'later');
              write(moved(sources, index, to));
            }}
            onRemove={() => write(sources.filter((_, position) => position !== index))}
          />
        ))}
      </ol>
      {sources.length === 1 && <p className={styles.notice}>Add at least one more PDF to merge.</p>}
      <div className={styles.actions}>
        <Button size="sm" variant="secondary" onClick={() => void add.handleAdd()}>
          <Plus size={14} />
          Add PDFs…
        </Button>
      </div>
      <PdfFileInput inputRef={add.input} onFiles={add.handleFiles} />
      {add.error && <p role="alert">{add.error}</p>}
    </section>
  );
}

type MergeCardProps = {
  dropTarget: boolean;
  index: number;
  isLast: boolean;
  source: PdfSource;
  onDragEnd(): void;
  onDragOver(event: DragEvent): void;
  onDragStart(): void;
  onDrop(event: DragEvent): void;
  onMove(to: number): void;
  onRemove(): void;
};

type MergeCardActionsProps = Pick<MergeCardProps, 'index' | 'isLast' | 'onMove' | 'onRemove'> & {
  name: string;
};

function MergeCardActions({
  index,
  isLast,
  name,
  onMove,
  onRemove,
}: MergeCardActionsProps): ReactElement {
  return (
    <span className={styles.tileActions}>
      <button
        aria-label={`Move ${name} up`}
        data-move="earlier"
        disabled={index === 0}
        type="button"
        onClick={() => onMove(index - 1)}
      >
        <ArrowUp size={13} />
      </button>
      <button
        aria-label={`Move ${name} down`}
        data-move="later"
        disabled={isLast}
        type="button"
        onClick={() => onMove(index + 1)}
      >
        <ArrowDown size={13} />
      </button>
      <button aria-label={`Remove ${name}`} type="button" onClick={onRemove}>
        <X size={13} />
      </button>
    </span>
  );
}

function MergeCard({
  dropTarget,
  index,
  isLast,
  source,
  onDragEnd,
  onDragOver,
  onDragStart,
  onDrop,
  onMove,
  onRemove,
}: MergeCardProps): ReactElement {
  const thumbnails = usePdfThumbnails(source.data, { limit: 1, width: 56 });
  const pages = mergeFileStatus(thumbnails.pageCount, thumbnails.status === 'error');

  return (
    <li
      className={styles.file}
      data-drop={dropTarget}
      draggable
      onDragEnd={onDragEnd}
      onDragOver={onDragOver}
      onDragStart={(event) => {
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', source.name);
        onDragStart();
      }}
      onDrop={onDrop}
    >
      <span className={styles.fileSheet}>
        {thumbnails.pages[0] ? (
          <img alt="" draggable={false} src={thumbnails.pages[0].url} />
        ) : (
          <span aria-hidden="true" className={styles.blank} />
        )}
      </span>
      <span className={styles.fileText}>
        <strong>
          {index + 1}. {source.name}
        </strong>
        <small>
          {pages} · {bytesText(dataUriByteLength(source.data))}
        </small>
      </span>
      <MergeCardActions
        index={index}
        isLast={isLast}
        name={source.name}
        onMove={onMove}
        onRemove={onRemove}
      />
    </li>
  );
}

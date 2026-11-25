import { ChevronDown, ChevronsDownUp, ChevronsUpDown } from 'lucide-react';
import { useId, useState, type ReactElement, type ReactNode } from 'react';
import styles from './Accordion.module.scss';

export interface AccordionItemData {
  content: ReactNode;
  id: string;
  title: ReactNode;
}

export interface AccordionProps {
  header?: ReactNode;
  items: AccordionItemData[];
}

type AccordionToggleAllProps = {
  areAllExpanded: boolean;
  onToggleAll(): void;
};

function AccordionToggleAll({
  areAllExpanded,
  onToggleAll,
}: AccordionToggleAllProps): ReactElement {
  return (
    <button
      aria-label={areAllExpanded ? 'Collapse all sections' : 'Expand all sections'}
      className={styles.toggleAllButton}
      type="button"
      onClick={onToggleAll}
    >
      {areAllExpanded ? (
        <>
          <ChevronsDownUp size={13} />
          <span>Collapse all</span>
        </>
      ) : (
        <>
          <ChevronsUpDown size={13} />
          <span>Expand all</span>
        </>
      )}
    </button>
  );
}

type AccordionItemProps = {
  baseId: string;
  isOpen: boolean;
  item: AccordionItemData;
  onToggle(): void;
};

type AccordionTriggerProps = Omit<AccordionItemProps, 'baseId'> & {
  panelId: string;
  triggerId: string;
};

function AccordionTrigger({
  isOpen,
  item,
  panelId,
  triggerId,
  onToggle,
}: AccordionTriggerProps): ReactElement {
  return (
    <button
      aria-controls={panelId}
      aria-expanded={isOpen}
      className={styles.trigger}
      id={triggerId}
      type="button"
      onClick={onToggle}
    >
      <span className={styles.titleGroup}>
        <span aria-hidden="true" className={styles.indexBadge} />
        <span className={styles.title}>{item.title}</span>
      </span>
      <span aria-hidden="true" className={styles.iconWrap}>
        <ChevronDown size={16} />
      </span>
    </button>
  );
}

function AccordionItem({ baseId, isOpen, item, onToggle }: AccordionItemProps): ReactElement {
  const triggerId = `${baseId}-trigger-${item.id}`;
  const panelId = `${baseId}-panel-${item.id}`;
  const openClassName = isOpen ? styles.isOpen : '';

  return (
    <div className={`${styles.item} ${openClassName}`}>
      <h3 className={styles.header}>
        <AccordionTrigger
          isOpen={isOpen}
          item={item}
          panelId={panelId}
          triggerId={triggerId}
          onToggle={onToggle}
        />
      </h3>

      <div
        aria-labelledby={triggerId}
        className={`${styles.contentWrapper} ${openClassName}`}
        id={panelId}
        inert={!isOpen}
        role="region"
      >
        <div className={styles.contentInner}>
          <div className={styles.contentBody}>{item.content}</div>
        </div>
      </div>
    </div>
  );
}

type AccordionState = {
  areAllExpanded: boolean;
  expandedIds: Set<string>;
  handleToggle(id: string): void;
  handleToggleAll(): void;
};

function useAccordionState(items: AccordionItemData[]): AccordionState {
  const [expandedIds, setExpandedIds] = useState(
    () => new Set(items.slice(0, 1).map(({ id }) => id)),
  );
  const areAllExpanded = items.length > 0 && items.every(({ id }) => expandedIds.has(id));

  const handleToggle = (id: string) =>
    setExpandedIds((previous) => {
      const next = new Set(previous);

      if (!next.delete(id)) next.add(id);

      return next;
    });

  const handleToggleAll = () =>
    setExpandedIds(areAllExpanded ? new Set() : new Set(items.map(({ id }) => id)));

  return { areAllExpanded, expandedIds, handleToggle, handleToggleAll };
}

export function Accordion({ header, items }: AccordionProps): ReactElement {
  const baseId = useId();
  const { areAllExpanded, expandedIds, handleToggle, handleToggleAll } = useAccordionState(items);
  const hasToggleAll = items.length > 1;

  return (
    <div className={styles.accordion}>
      {(header || hasToggleAll) && (
        <div className={styles.headerRow}>
          {header ? <div className={styles.headerCustom}>{header}</div> : <div />}
          {hasToggleAll && (
            <div className={styles.controls}>
              <AccordionToggleAll areAllExpanded={areAllExpanded} onToggleAll={handleToggleAll} />
            </div>
          )}
        </div>
      )}

      {items.map((item) => (
        <AccordionItem
          baseId={baseId}
          isOpen={expandedIds.has(item.id)}
          item={item}
          key={item.id}
          onToggle={() => handleToggle(item.id)}
        />
      ))}
    </div>
  );
}

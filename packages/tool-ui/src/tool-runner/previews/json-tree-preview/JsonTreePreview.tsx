import {
  initialJsonTreeExpansion,
  visibleJsonTreeNodes,
  type JsonTreeNode,
} from '@devtoolora/core';
import { Button, Input } from '../../../ui';
import { useEffect, useMemo, useState, type ReactElement } from 'react';
import styles from './JsonTreePreview.module.scss';

interface JsonTreePreviewProps {
  expandedLevels?: number;
  nodes: JsonTreeNode[];
  onCopyText(text: string): Promise<void>;
}

function toggledId(expanded: Set<number>, id: number): Set<number> {
  const next = new Set(expanded);

  if (next.has(id)) next.delete(id);
  else next.add(id);

  return next;
}

type JsonTreeToolbarProps = {
  shownCount: number;
  visibleCount: number;
  onCollapseAll(): void;
  onExpandAll(): void;
};

function JsonTreeToolbar({
  shownCount,
  visibleCount,
  onCollapseAll,
  onExpandAll,
}: JsonTreeToolbarProps): ReactElement {
  return (
    <div className={styles.toolbar}>
      <Button size="sm" variant="secondary" onClick={onExpandAll}>
        Expand all
      </Button>
      <Button size="sm" variant="ghost" onClick={onCollapseAll}>
        Collapse all
      </Button>
      <small>
        {shownCount} of {visibleCount} visible rows
      </small>
    </div>
  );
}

type JsonTreeRowProps = {
  isExpanded: boolean;
  isSearching: boolean;
  isSelected: boolean;
  node: JsonTreeNode;
  onSelect(): void;
  onToggle(): void;
};

function JsonTreeRow({
  isExpanded,
  isSearching,
  isSelected,
  node,
  onSelect,
  onToggle,
}: JsonTreeRowProps): ReactElement {
  return (
    <li
      className={styles.row}
      data-selected={isSelected}
      style={{ paddingInlineStart: `${Math.min(node.depth, 12) * 12}px` }}
    >
      {node.childCount > 0 ? (
        <Button
          aria-expanded={isSearching ? true : isExpanded}
          aria-label={`Toggle ${node.label}`}
          disabled={isSearching}
          size="sm"
          variant="ghost"
          onClick={onToggle}
        >
          {isSearching || isExpanded ? '▾' : '▸'}
        </Button>
      ) : (
        <span aria-hidden="true" className={styles.leaf}>
          ·
        </span>
      )}
      <button
        aria-pressed={isSelected}
        className={styles.select}
        title={node.pointer || 'Root (empty pointer)'}
        type="button"
        onClick={onSelect}
      >
        <span className={styles.label}>{node.label.slice(0, 100)}</span>
        <span className={styles.type}>{node.type}</span>
        <span className={styles.value}>
          {node.type === 'array' || node.type === 'object'
            ? `${node.childCount} children`
            : node.token.slice(0, 120)}
        </span>
      </button>
    </li>
  );
}

type JsonTreeDetailProps = {
  node: JsonTreeNode;
  status: string;
  onCopy(value: string): void;
};

function JsonTreeDetail({ node, status, onCopy }: JsonTreeDetailProps): ReactElement {
  const isContainer = node.type === 'object' || node.type === 'array';

  return (
    <section aria-label="Selected JSON value" className={styles.detail}>
      <h3>Selected value · {node.type}</h3>
      <p>
        JSON Pointer: <code>{JSON.stringify(node.pointer)}</code>
      </p>
      {isContainer ? (
        <p>{node.childCount} children; select a scalar to inspect its original token.</p>
      ) : (
        <pre>{node.token}</pre>
      )}
      <div className={styles.toolbar}>
        <Button size="sm" variant="secondary" onClick={() => onCopy(node.pointer)}>
          Copy pointer
        </Button>
        {!isContainer && (
          <Button size="sm" variant="ghost" onClick={() => onCopy(node.token)}>
            Copy scalar token
          </Button>
        )}
      </div>
      <p aria-live="polite">{status}</p>
    </section>
  );
}

type JsonTreeState = {
  expanded: Set<number>;
  handleCollapseAll(): void;
  handleCopy(value: string): Promise<void>;
  handleExpandAll(): void;
  handleQueryChange(value: string): void;
  handleSelect(id: number): void;
  handleShowMore(): void;
  handleToggle(id: number): void;
  limit: number;
  query: string;
  selected: JsonTreeNode | undefined;
  selectedId: number;
  status: string;
  visible: JsonTreeNode[];
};

function useJsonTreeState(
  nodes: JsonTreeNode[],
  expandedLevels: number | undefined,
  onCopyText: JsonTreePreviewProps['onCopyText'],
): JsonTreeState {
  const [expanded, setExpanded] = useState<Set<number>>(() =>
    initialJsonTreeExpansion(nodes, expandedLevels),
  );
  const [query, setQuery] = useState('');
  const [limit, setLimit] = useState(200);
  const [selectedId, setSelectedId] = useState(0);
  const [status, setStatus] = useState('');
  const visible = useMemo(
    () => visibleJsonTreeNodes(nodes, expanded, query),
    [nodes, expanded, query],
  );
  const selected = nodes.find((node) => node.id === selectedId) ?? nodes[0];

  useEffect(() => {
    setExpanded(initialJsonTreeExpansion(nodes, expandedLevels));
    setQuery('');
    setLimit(200);
    setSelectedId(0);
    setStatus('');
  }, [expandedLevels, nodes]);

  async function handleCopy(value: string): Promise<void> {
    try {
      await onCopyText(value);
      setStatus('Copied.');
    } catch {
      setStatus('Copy failed.');
    }
  }

  return {
    expanded,
    handleCollapseAll: () => {
      setExpanded(new Set());
      setQuery('');
      setLimit(200);
    },
    handleCopy,
    handleExpandAll: () =>
      setExpanded(new Set(nodes.filter((node) => node.childCount > 0).map((node) => node.id))),
    handleQueryChange: (value) => {
      setQuery(value);
      setLimit(200);
    },
    handleSelect: (id) => {
      setSelectedId(id);
      setStatus('');
    },
    handleShowMore: () => setLimit((previous) => previous + 200),
    handleToggle: (id) => setExpanded((previous) => toggledId(previous, id)),
    limit,
    query,
    selected,
    selectedId,
    status,
    visible,
  };
}

export function JsonTreePreview({
  expandedLevels,
  nodes,
  onCopyText,
}: JsonTreePreviewProps): ReactElement {
  const tree = useJsonTreeState(nodes, expandedLevels, onCopyText);
  const { limit, selected, visible } = tree;

  return (
    <section aria-label="Interactive JSON outline" className={styles.viewer}>
      <label className={styles.search}>
        Search keys, paths, types and tokens
        <Input type="search" value={tree.query} onChange={tree.handleQueryChange} />
      </label>

      <JsonTreeToolbar
        shownCount={Math.min(limit, visible.length)}
        visibleCount={visible.length}
        onCollapseAll={tree.handleCollapseAll}
        onExpandAll={tree.handleExpandAll}
      />

      <ul aria-label="JSON values" className={styles.rows}>
        {visible.slice(0, limit).map((node) => (
          <JsonTreeRow
            isExpanded={tree.expanded.has(node.id)}
            isSearching={Boolean(tree.query.trim())}
            isSelected={node.id === tree.selectedId}
            key={node.id}
            node={node}
            onSelect={() => tree.handleSelect(node.id)}
            onToggle={() => tree.handleToggle(node.id)}
          />
        ))}
      </ul>

      {visible.length === 0 && <p>No matching values.</p>}
      {visible.length > limit && (
        <Button size="sm" variant="secondary" onClick={tree.handleShowMore}>
          Show more
        </Button>
      )}
      {selected && (
        <JsonTreeDetail
          node={selected}
          status={tree.status}
          onCopy={(value) => void tree.handleCopy(value)}
        />
      )}
    </section>
  );
}

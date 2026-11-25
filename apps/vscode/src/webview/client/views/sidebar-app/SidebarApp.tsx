import type { SerializedToolDefinition } from '@devtoolora/core';
import { ChevronsDownUp, ChevronsUpDown, Search } from 'lucide-react';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactElement,
  type RefObject,
} from 'react';
import { createRoot } from 'react-dom/client';
import { collapsibleSectionLabels, ToolList } from '../../components/tool-list';
import { filterTools } from '../../utils/filterTools';
import type { WebviewConfig } from '../../types';
import { useSidebarState } from '../../hooks/useSidebarState';
import { getVscode } from '../../host/vscodeHost';
import styles from './SidebarApp.module.scss';

export type SidebarAppProps = {
  config: WebviewConfig;
  tools: SerializedToolDefinition[];
};

function focusListItem(list: HTMLElement, direction: 1 | -1): void {
  const items = Array.from(list.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'));

  if (items.length === 0) return;

  const current = items.indexOf(document.activeElement as HTMLButtonElement);

  items[(current + direction + items.length) % items.length]?.focus();
}

function useSearchShortcut(searchRef: RefObject<HTMLInputElement | null>): void {
  useEffect(() => {
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key.toLowerCase() === 'k' && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        searchRef.current?.focus();
        searchRef.current?.select();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [searchRef]);
}

type CatalogKeysOptions = {
  listRef: RefObject<HTMLDivElement | null>;
  query: string;
  tools: SerializedToolDefinition[];
  onOpenTool(toolId: string): void;
  onQueryChange(query: string): void;
};

function useCatalogKeys({ listRef, query, tools, onOpenTool, onQueryChange }: CatalogKeysOptions) {
  const handleSearchKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' && query.trim()) {
      event.preventDefault();
      const top = filterTools(tools, query)[0];

      if (top) onOpenTool(top.id);
    } else if (event.key === 'Escape' && query) {
      event.preventDefault();
      onQueryChange('');
    } else if (event.key === 'ArrowDown' && listRef.current) {
      event.preventDefault();
      focusListItem(listRef.current, 1);
    }
  };

  const handleListKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;

    event.preventDefault();
    focusListItem(event.currentTarget, event.key === 'ArrowDown' ? 1 : -1);
  };

  return { handleListKeyDown, handleSearchKeyDown };
}

type ToggleAllProps = {
  isDisabled: boolean;
  isExpanded: boolean;
  onClick(): void;
};

function ToggleAllButton({ isDisabled, isExpanded, onClick }: ToggleAllProps): ReactElement {
  const label = isExpanded ? 'Collapse all' : 'Expand all';

  return (
    <button
      aria-label={label}
      className={styles.toggleAll}
      disabled={isDisabled}
      title={label}
      type="button"
      onClick={onClick}
    >
      {isExpanded ? (
        <ChevronsDownUp aria-hidden="true" size={14} />
      ) : (
        <ChevronsUpDown aria-hidden="true" size={14} />
      )}
    </button>
  );
}

function Brand(): ReactElement {
  return (
    <header className={styles.brand}>
      <svg aria-hidden="true" className={styles.flowBracket} viewBox="0 0 64 64">
        <path
          className={styles.flowBracketAccent}
          d="M8 10h31l-7 8H18l-8 8 8 8h10v8H15L0 26 15 10Z"
        />
        <path d="M25 22h18l13 14-13 18H18l7-8h14l7-10-7-7H25Z" />
        <path className={styles.flowBracketCalibration} d="M27 31h7v7h-7z" />
      </svg>
      <span className={styles.brandText}>
        <strong>Dev Toolora</strong>
      </span>
    </header>
  );
}

type SearchBoxProps = {
  inputRef: RefObject<HTMLInputElement | null>;
  query: string;
  onKeyDown(event: KeyboardEvent<HTMLInputElement>): void;
  onQueryChange(query: string): void;
};

function SearchBox({ inputRef, query, onKeyDown, onQueryChange }: SearchBoxProps): ReactElement {
  return (
    <label className={styles.search}>
      <Search aria-hidden="true" className={styles.searchIcon} size={15} />
      <input
        aria-label="Search tools"
        autoComplete="off"
        placeholder="Search tools…"
        ref={inputRef}
        type="search"
        value={query}
        onChange={(event) => onQueryChange(event.target.value)}
        onKeyDown={onKeyDown}
      />
      <kbd>{/Mac/.test(navigator.userAgent) ? '⌘ K' : 'Ctrl K'}</kbd>
    </label>
  );
}

function useHostToolActions() {
  const openTool = useCallback((toolId: string) => {
    getVscode().postMessage({ toolId, type: 'openTool' });
  }, []);
  const toggleFavorite = useCallback((toolId: string) => {
    getVscode().postMessage({ toolId, type: 'toggleFavorite' });
  }, []);

  return { openTool, toggleFavorite };
}

export function SidebarApp({ config, tools }: SidebarAppProps): ReactElement {
  const { collapsedCategories, navigation, setCollapsed, toggleCollapsed } = useSidebarState(
    tools,
    config,
  );
  const [query, setQuery] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useSearchShortcut(searchRef);

  const { openTool, toggleFavorite } = useHostToolActions();

  const { handleListKeyDown, handleSearchKeyDown } = useCatalogKeys({
    listRef,
    query,
    tools,
    onOpenTool: openTool,
    onQueryChange: setQuery,
  });

  const labels = collapsibleSectionLabels(tools, navigation);
  const hasExpandedSection = labels.some((label) => !collapsedCategories.has(label));

  return (
    <aside className={styles.shell}>
      <Brand />
      <SearchBox
        inputRef={searchRef}
        query={query}
        onKeyDown={handleSearchKeyDown}
        onQueryChange={setQuery}
      />
      <div className={styles.categoriesHeader}>
        <span className={styles.sectionTitle}>Categories</span>
        <ToggleAllButton
          isDisabled={query.trim() !== '' || labels.length === 0}
          isExpanded={hasExpandedSection}
          onClick={() => setCollapsed(labels, hasExpandedSection)}
        />
      </div>
      <div className={styles.listFrame} ref={listRef} onKeyDown={handleListKeyDown}>
        <ToolList
          collapsedCategories={collapsedCategories}
          navigation={navigation}
          query={query}
          tools={tools}
          onOpenTool={openTool}
          onToggleCollapsed={toggleCollapsed}
          onToggleFavorite={toggleFavorite}
        />
      </div>
    </aside>
  );
}

export function mountSidebarApp(container: HTMLElement, props: SidebarAppProps): void {
  createRoot(container).render(<SidebarApp {...props} />);
}

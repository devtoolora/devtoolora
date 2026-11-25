import { ArrowRight, Search } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router';
// Not the barrel: Rolldown would pull its favorites hook, and with it all tool metadata, into home.
import { CategoryIcon } from '@/features/tools/components/category-icon';
import { getCategoryMeta } from '@/features/tools/utils/categoryIcons';
import { useSearchShortcutLabel } from '@/lib/useSearchShortcutLabel';
import type { WebToolMetadata } from '@/toolMetadata';
import { searchTools } from './searchTools';
import { useListboxNavigation } from './useListboxNavigation';
import styles from './CommandSearch.module.scss';

type CommandSearchProps = {
  defaultResults: WebToolMetadata[];
  toolCount: number;
};

const resultIconAccentClasses: Record<'calibration' | 'signal', string | undefined> = {
  calibration: styles.isCalibration,
  signal: styles.isSignal,
};

const searchParticles = Array.from({ length: 10 }, (_, index) => index);

type SearchStatus = 'failed' | 'loading' | 'ready';

const emptyResultMessages: Record<SearchStatus, string> = {
  failed: 'Search is unavailable. Reload the page to try again.',
  loading: 'Loading tools…',
  ready: 'No matching tool. Browse the categories below.',
};

interface CommandSearchResultsProps {
  activeIndex: number;
  results: WebToolMetadata[];
  status: SearchStatus;
  onActiveIndexChange(index: number): void;
}

function SearchBackdrop() {
  return (
    <>
      <span aria-hidden="true" className={styles.searchAurora} data-testid="search-aurora" />
      <span aria-hidden="true" className={styles.searchParticles}>
        {searchParticles.map((particle) => (
          <span className={styles.searchParticle} data-testid="search-particle" key={particle} />
        ))}
      </span>
    </>
  );
}

function SearchFooter() {
  return (
    <div className={styles.footer}>
      <div aria-label="Keyboard navigation shortcuts" className={styles.footerHints}>
        <span>
          Press <kbd>↑</kbd> <kbd>↓</kbd> to navigate
        </span>
        <span>
          <kbd>Enter</kbd> to open
        </span>
      </div>
      <Link className={styles.footerAll} to="/tools">
        View all tools
        <ArrowRight aria-hidden="true" size={14} />
      </Link>
    </div>
  );
}

function CommandSearchResults({
  activeIndex,
  results,
  status,
  onActiveIndexChange,
}: CommandSearchResultsProps) {
  return (
    <div
      aria-label="Tool results"
      className={styles.results}
      id="tool-search-results"
      role="listbox"
    >
      {results.map((tool, index) => {
        const meta = getCategoryMeta(tool.category);

        return (
          <Link
            aria-selected={index === activeIndex}
            className={styles.resultItem}
            data-active={index === activeIndex}
            id={`tool-result-${tool.id}`}
            key={tool.id}
            role="option"
            to={`/tools/${tool.slug}`}
            onMouseEnter={() => onActiveIndexChange(index)}
          >
            <span
              aria-hidden="true"
              className={`${styles.resultIcon} ${resultIconAccentClasses[meta.accent]}`}
            >
              <CategoryIcon badge={tool.badge} category={tool.category} size={18} />
            </span>
            <span className={styles.resultCopy}>
              <strong>{tool.name}</strong>
              <small>{tool.description}</small>
            </span>
            <span className={styles.resultCategory}>{tool.category}</span>
          </Link>
        );
      })}

      {results.length === 0 && (
        <div aria-selected="false" className={styles.empty} role="option">
          {emptyResultMessages[status]}
        </div>
      )}
    </div>
  );
}

interface CommandSearchInputProps {
  activeResult?: WebToolMetadata;
  inputRef: React.RefObject<HTMLInputElement | null>;
  isOpen: boolean;
  query: string;
  toolCount: number;
  onChange(event: React.ChangeEvent<HTMLInputElement>): void;
  onKeyDown(event: React.KeyboardEvent<HTMLInputElement>): void;
  onOpen(): void;
}

function CommandSearchInput({
  activeResult,
  inputRef,
  isOpen,
  query,
  toolCount,
  onChange,
  onKeyDown,
  onOpen,
}: CommandSearchInputProps) {
  const shortcutLabel = useSearchShortcutLabel();

  return (
    <div className={styles.inputRow}>
      <Search aria-hidden="true" size={20} strokeWidth={1.6} />
      <input
        aria-activedescendant={
          isOpen && activeResult ? `tool-result-${activeResult.id}` : undefined
        }
        aria-autocomplete="list"
        aria-controls="tool-search-results"
        aria-expanded={isOpen}
        aria-label="Search developer tools"
        placeholder={`Search ${toolCount} tools...`}
        ref={inputRef}
        role="combobox"
        type="search"
        value={query}
        onChange={onChange}
        onFocus={onOpen}
        onKeyDown={onKeyDown}
      />
      <kbd>{shortcutLabel}</kbd>
    </div>
  );
}

function useSearchHotkey(
  inputRef: React.RefObject<HTMLInputElement | null>,
  setIsOpen: (isOpen: boolean) => void,
) {
  useEffect(() => {
    const handleGlobalKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        inputRef.current?.focus();
        setIsOpen(true);
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);

    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [inputRef, setIsOpen]);
}

function CommandSearchPanel({
  activeIndex,
  results,
  status,
  onActiveIndexChange,
}: CommandSearchResultsProps) {
  return (
    <div className={styles.searchResultsPanel}>
      <CommandSearchResults
        activeIndex={activeIndex}
        results={results}
        status={status}
        onActiveIndexChange={onActiveIndexChange}
      />
      <SearchFooter />
    </div>
  );
}

function useBlurClose(setIsOpen: (isOpen: boolean) => void) {
  const containerRef = useRef<HTMLDivElement>(null);

  const handleBlur = (event: React.FocusEvent<HTMLDivElement>) => {
    if (!containerRef.current?.contains(event.relatedTarget)) {
      setIsOpen(false);
    }
  };

  return { containerRef, handleBlur };
}

interface ResultKeysOptions {
  inputRef: React.RefObject<HTMLInputElement | null>;
  isOpen: boolean;
  navigation: ReturnType<typeof useListboxNavigation>;
  results: WebToolMetadata[];
  setIsOpen: (isOpen: boolean) => void;
}

function useResultKeys({ inputRef, isOpen, navigation, results, setIsOpen }: ResultKeysOptions) {
  const navigate = useNavigate();

  return (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') {
      setIsOpen(false);
      inputRef.current?.blur();

      return;
    }

    if (event.key === 'ArrowDown') setIsOpen(true);
    if (event.key === 'Enter' && !isOpen) return;

    const picked = navigation.onKeyDown(event);

    if (picked !== undefined) void navigate(`/tools/${results[picked]!.slug}`);
  };
}

// Loaded on first use so the homepage does not ship the full metadata.
function useToolSearch(defaultResults: WebToolMetadata[], query: string) {
  const [tools, setTools] = useState<WebToolMetadata[]>();
  const [status, setStatus] = useState<SearchStatus>('loading');
  const loadRef = useRef<Promise<void>>(undefined);
  const pendingResults = query.trim() ? [] : defaultResults;

  // One import at a time. A failure is cleared so focus or input retries it; Chromium keeps the
  // failed module, so there the message asks for a reload.
  const handleToolsLoad = () => {
    if (loadRef.current) return;

    setStatus('loading');

    loadRef.current = import('@/toolMetadata.generated').then(
      (module) => {
        setTools(module.webToolMetadata);
        setStatus('ready');
      },
      () => {
        loadRef.current = undefined;
        setStatus('failed');
      },
    );
  };

  return {
    results: tools ? searchTools(tools, query) : pendingResults,
    status,
    onToolsLoad: handleToolsLoad,
  };
}

export function CommandSearch({ defaultResults, toolCount }: CommandSearchProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(true);
  const { results, status, onToolsLoad } = useToolSearch(defaultResults, query);
  const navigation = useListboxNavigation(results.length);
  const { activeIndex } = navigation;
  const { containerRef, handleBlur } = useBlurClose(setIsOpen);

  useSearchHotkey(inputRef, setIsOpen);

  const handleKeyDown = useResultKeys({ inputRef, isOpen, navigation, results, setIsOpen });

  const handleQueryChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(event.target.value);
    navigation.reset();
    setIsOpen(true);
  };

  const handleOpen = () => {
    setIsOpen(true);
  };

  return (
    <div className={styles.searchStage}>
      <SearchBackdrop />

      <div
        className={styles.commandSearch}
        data-testid="command-search"
        ref={containerRef}
        onBlur={handleBlur}
        onFocus={onToolsLoad}
        onInput={onToolsLoad}
        onPointerEnter={onToolsLoad}
      >
        <CommandSearchInput
          activeResult={results[activeIndex]}
          inputRef={inputRef}
          isOpen={isOpen}
          query={query}
          toolCount={toolCount}
          onChange={handleQueryChange}
          onKeyDown={handleKeyDown}
          onOpen={handleOpen}
        />

        {isOpen && (
          <CommandSearchPanel
            activeIndex={activeIndex}
            results={results}
            status={status}
            onActiveIndexChange={navigation.onActiveIndexChange}
          />
        )}
      </div>
    </div>
  );
}

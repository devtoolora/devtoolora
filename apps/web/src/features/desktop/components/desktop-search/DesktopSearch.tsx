import { Search } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { searchTools, useListboxNavigation } from '@/features/search';
import { CategoryIcon } from '@/features/tools';
import { useSearchShortcutLabel } from '@/lib/useSearchShortcutLabel';
import type { WebToolMetadata } from '@/toolMetadata';
import { webToolMetadata } from '@/toolMetadata.generated';
import styles from './DesktopSearch.module.scss';

export interface DesktopSearchProps {
  onToolOpen(tool: WebToolMetadata): void;
}

interface DesktopSearchResultsProps {
  activeIndex: number;
  results: WebToolMetadata[];
  onActiveIndexChange(index: number): void;
  onToolOpen(tool: WebToolMetadata): void;
}

function DesktopSearchResults({
  activeIndex,
  results,
  onActiveIndexChange,
  onToolOpen,
}: DesktopSearchResultsProps) {
  return (
    <div
      className={styles.results}
      data-testid="desktop-search-results"
      id="desktop-search-results"
      role="listbox"
    >
      {results.map((tool, index) => (
        <button
          aria-selected={index === activeIndex}
          data-active={index === activeIndex}
          id={`desktop-result-${tool.id}`}
          key={tool.id}
          role="option"
          type="button"
          onClick={() => onToolOpen(tool)}
          onMouseDown={(event) => event.preventDefault()}
          onMouseEnter={() => onActiveIndexChange(index)}
        >
          <CategoryIcon badge={tool.badge} category={tool.category} size={15} />
          <strong>{tool.name}</strong>
          <small>{tool.category}</small>
        </button>
      ))}
      {!results.length && <p>No matching local tool.</p>}
    </div>
  );
}

interface DesktopSearchInputProps {
  activeResult?: WebToolMetadata;
  inputRef: React.RefObject<HTMLInputElement | null>;
  isOpen: boolean;
  query: string;
  onChange(event: React.ChangeEvent<HTMLInputElement>): void;
  onKeyDown(event: React.KeyboardEvent<HTMLInputElement>): void;
  onOpen(): void;
}

function DesktopSearchInput({
  activeResult,
  inputRef,
  isOpen,
  query,
  onChange,
  onKeyDown,
  onOpen,
}: DesktopSearchInputProps) {
  return (
    <input
      aria-activedescendant={
        isOpen && activeResult ? `desktop-result-${activeResult.id}` : undefined
      }
      aria-controls="desktop-search-results"
      aria-expanded={isOpen}
      aria-label="Search desktop tools"
      placeholder="Search tools, tasks, or formats…"
      ref={inputRef}
      role="combobox"
      type="search"
      value={query}
      onChange={onChange}
      onFocus={onOpen}
      onKeyDown={onKeyDown}
    />
  );
}

interface SearchShortcutsOptions {
  containerRef: React.RefObject<HTMLDivElement | null>;
  inputRef: React.RefObject<HTMLInputElement | null>;
  isOpen: boolean;
  onOpenChange(isOpen: boolean): void;
}

function useSearchShortcuts({
  containerRef,
  inputRef,
  isOpen,
  onOpenChange,
}: SearchShortcutsOptions) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        onOpenChange(true);
        inputRef.current?.focus();
      } else if (event.key === 'Escape' && isOpen) {
        onOpenChange(false);
        inputRef.current?.blur();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [inputRef, isOpen, onOpenChange]);

  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        onOpenChange(false);
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);

    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [containerRef, isOpen, onOpenChange]);
}

interface ResultKeysOptions {
  inputRef: React.RefObject<HTMLInputElement | null>;
  navigation: ReturnType<typeof useListboxNavigation>;
  results: WebToolMetadata[];
  setIsOpen: (isOpen: boolean) => void;
  onToolOpen(tool: WebToolMetadata): void;
}

function useResultKeys({
  inputRef,
  navigation,
  results,
  setIsOpen,
  onToolOpen,
}: ResultKeysOptions) {
  return (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') {
      setIsOpen(false);
      inputRef.current?.blur();

      return;
    }

    const picked = navigation.onKeyDown(event);

    if (picked !== undefined) onToolOpen(results[picked]!);
  };
}

export function DesktopSearch({ onToolOpen }: DesktopSearchProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const results = searchTools(webToolMetadata, query, 8);
  const navigation = useListboxNavigation(results.length);
  const { activeIndex } = navigation;
  const shortcutLabel = useSearchShortcutLabel();

  useSearchShortcuts({ containerRef, inputRef, isOpen, onOpenChange: setIsOpen });

  const openTool = (tool: WebToolMetadata) => {
    onToolOpen(tool);
    setQuery('');
    setIsOpen(false);
    inputRef.current?.blur();
  };

  const handleOpen = () => {
    setIsOpen(true);
  };

  const handleQueryChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(event.target.value);
    navigation.reset();
    setIsOpen(true);
  };

  const handleInputKeyDown = useResultKeys({
    inputRef,
    navigation,
    results,
    setIsOpen,
    onToolOpen: openTool,
  });

  return (
    <div className={styles.search} ref={containerRef}>
      <Search aria-hidden="true" size={17} />
      <DesktopSearchInput
        activeResult={results[activeIndex]}
        inputRef={inputRef}
        isOpen={isOpen}
        query={query}
        onChange={handleQueryChange}
        onKeyDown={handleInputKeyDown}
        onOpen={handleOpen}
      />
      <kbd>{shortcutLabel}</kbd>
      {isOpen && (
        <DesktopSearchResults
          activeIndex={activeIndex}
          results={results}
          onActiveIndexChange={navigation.onActiveIndexChange}
          onToolOpen={openTool}
        />
      )}
    </div>
  );
}

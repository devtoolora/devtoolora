import type { SerializedToolDefinition } from '@devtoolora/core';
import type { ReactElement } from 'react';
import { filterTools, formatRelativeTime, groupToolsByCategory } from '../../utils/filterTools';
import type { NavigationState } from '../../types';
import { ToolIcon } from '../tool-icon';
import styles from './ToolList.module.scss';

export type ToolListProps = {
  collapsedCategories: Set<string>;
  navigation: NavigationState;
  query: string;
  tools: SerializedToolDefinition[];
  onOpenTool(toolId: string): void;
  onToggleCollapsed(label: string): void;
  onToggleFavorite(toolId: string): void;
};

type RecentEntry = { timestamp: number; tool: SerializedToolDefinition };

// A hand-edited globalState can carry a timestamp outside the Date range; toISOString would throw.
const toDateTime = (timestamp: number): string | undefined =>
  Number.isNaN(new Date(timestamp).getTime()) ? undefined : new Date(timestamp).toISOString();

function toolsForIds(tools: SerializedToolDefinition[], ids: string[]): SerializedToolDefinition[] {
  const canonicalIds = new Set(
    ids.map((id) => tools.find((tool) => tool.id === id)?.aliasOf ?? id),
  );

  return tools.filter((tool) => canonicalIds.has(tool.id));
}

function recentEntries(
  tools: SerializedToolDefinition[],
  navigation: NavigationState,
): RecentEntry[] {
  return navigation.recentTools.flatMap((entry) => {
    const tool = tools.find((candidate) => (candidate.aliasOf ?? candidate.id) === entry.toolId);

    return tool ? [{ timestamp: entry.timestamp, tool }] : [];
  });
}

function activeCanonicalId(tools: SerializedToolDefinition[], navigation: NavigationState): string {
  const active = tools.find((tool) => tool.id === navigation.activeToolId);

  return active?.aliasOf ?? active?.id ?? '';
}

export function collapsibleSectionLabels(
  tools: SerializedToolDefinition[],
  navigation: NavigationState,
): string[] {
  const labels: string[] = [];

  if (toolsForIds(tools, navigation.favoriteToolIds).length > 0) labels.push('Favorites');
  if (recentEntries(tools, navigation).length > 0) labels.push('Recent');

  labels.push(...groupToolsByCategory(tools).keys());

  return labels;
}

type SectionProps = {
  children: ReactElement | ReactElement[];
  count: number;
  isCollapsed: boolean;
  label: string;
  onToggle?(): void;
};

function chevronFor(isCollapsible: boolean, isCollapsed: boolean): string {
  if (!isCollapsible) return '';

  return isCollapsed ? '›' : '⌄';
}

function Section({ children, count, isCollapsed, label, onToggle }: SectionProps): ReactElement {
  const chevron = chevronFor(Boolean(onToggle), isCollapsed);

  return (
    <section aria-label={label} className={styles.section}>
      <button
        aria-expanded={!isCollapsed}
        className={styles.sectionHeader}
        disabled={!onToggle}
        type="button"
        onClick={onToggle}
      >
        <span aria-hidden="true" className={styles.chevron}>
          {chevron}
        </span>
        <span>{label}</span>
        <span className={styles.count}>{count}</span>
      </button>
      {!isCollapsed && <div className={styles.sectionTools}>{children}</div>}
    </section>
  );
}

type ToolRowProps = {
  activeToolId: string;
  isFavorite?: boolean;
  timestamp?: number;
  tool: SerializedToolDefinition;
  onOpen(): void;
  onToggleFavorite?(): void;
};

function ToolRow({
  activeToolId,
  isFavorite = false,
  timestamp,
  tool,
  onOpen,
  onToggleFavorite,
}: ToolRowProps): ReactElement {
  const favoriteLabel = isFavorite
    ? `Remove ${tool.name} from favorites`
    : `Add ${tool.name} to favorites`;

  return (
    <div className={styles.row} data-active={tool.id === activeToolId}>
      <button
        aria-current={tool.id === activeToolId ? 'true' : undefined}
        className={styles.tool}
        data-tool-id={tool.id}
        type="button"
        onClick={onOpen}
      >
        <ToolIcon badge={tool.badge} category={tool.category} size={14} />
        <strong className={styles.name}>{tool.name}</strong>
      </button>
      {timestamp !== undefined && (
        <time className={styles.recentTime} dateTime={toDateTime(timestamp)}>
          {formatRelativeTime(timestamp)}
        </time>
      )}
      {onToggleFavorite && (
        <button
          aria-label={favoriteLabel}
          className={styles.favorite}
          title={favoriteLabel}
          type="button"
          onClick={onToggleFavorite}
        >
          {isFavorite ? '★' : '☆'}
        </button>
      )}
    </div>
  );
}

type RowsProps = Pick<ToolListProps, 'navigation' | 'tools' | 'onOpenTool' | 'onToggleFavorite'>;

function useRows({ navigation, tools, onOpenTool, onToggleFavorite }: RowsProps) {
  const activeToolId = activeCanonicalId(tools, navigation);
  const favorites = toolsForIds(tools, navigation.favoriteToolIds);
  const favoriteIds = new Set(favorites.map((tool) => tool.id));
  const rows = (sectionTools: SerializedToolDefinition[]) =>
    sectionTools.map((tool) => (
      <ToolRow
        activeToolId={activeToolId}
        isFavorite={favoriteIds.has(tool.id)}
        key={tool.id}
        tool={tool}
        onOpen={() => onOpenTool(tool.id)}
        onToggleFavorite={() => onToggleFavorite(tool.id)}
      />
    ));

  return { activeToolId, favorites, rows };
}

function SearchResults({ query, ...props }: RowsProps & { query: string }): ReactElement {
  const { rows } = useRows(props);
  const matches = filterTools(props.tools, query);

  if (matches.length === 0) return <p className={styles.empty}>No tools match this search.</p>;

  return (
    <Section count={matches.length} isCollapsed={false} label="Search results">
      {rows(matches)}
    </Section>
  );
}

function CatalogSections({
  collapsedCategories,
  onToggleCollapsed,
  ...props
}: Omit<ToolListProps, 'query'>): ReactElement {
  const { activeToolId, favorites, rows } = useRows(props);
  const { navigation, tools, onOpenTool } = props;
  const recents = recentEntries(tools, navigation);
  const section = (label: string, sectionTools: SerializedToolDefinition[]) => (
    <Section
      count={sectionTools.length}
      isCollapsed={collapsedCategories.has(label)}
      key={label}
      label={label}
      onToggle={() => onToggleCollapsed(label)}
    >
      {rows(sectionTools)}
    </Section>
  );

  return (
    <>
      {favorites.length > 0 && section('Favorites', favorites)}
      {recents.length > 0 && (
        <Section
          count={recents.length}
          isCollapsed={collapsedCategories.has('Recent')}
          label="Recent"
          onToggle={() => onToggleCollapsed('Recent')}
        >
          {recents.map(({ timestamp, tool }) => (
            <ToolRow
              activeToolId={activeToolId}
              key={tool.id}
              timestamp={timestamp}
              tool={tool}
              onOpen={() => onOpenTool(tool.id)}
            />
          ))}
        </Section>
      )}
      {Array.from(groupToolsByCategory(tools), ([category, categoryTools]) =>
        section(category, categoryTools),
      )}
    </>
  );
}

export function ToolList({ query, ...props }: ToolListProps): ReactElement {
  return (
    <div aria-label="Developer tools" className={styles.list}>
      {query.trim() ? <SearchResults query={query} {...props} /> : <CatalogSections {...props} />}
    </div>
  );
}

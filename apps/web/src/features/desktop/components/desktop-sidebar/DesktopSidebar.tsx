import type { ToolCategory } from '@devtoolora/core';
import { Clock3, type LucideIcon, Star } from 'lucide-react';
import { CategoryIcon } from '@/features/tools';
import type { WebToolMetadata } from '@/toolMetadata';
import { webToolMetadata } from '@/toolMetadata.generated';
import styles from './DesktopSidebar.module.scss';
import { DesktopToolLink } from '../desktop-tool-link';

type ToolSectionKind = 'favorites' | 'recent';

interface ToolSectionContent {
  emptyText: string;
  icon: LucideIcon;
  title: string;
}

interface DesktopSidebarProps {
  favoriteTools: WebToolMetadata[];
  recentTools: WebToolMetadata[];
  selectedTool: WebToolMetadata;
  showRecent: boolean;
  onToolOpen(tool: WebToolMetadata): void;
}

interface ToolSectionProps {
  activeToolId: string;
  kind: ToolSectionKind;
  tools: WebToolMetadata[];
  onToolOpen(tool: WebToolMetadata): void;
}

interface CategorySectionProps {
  activeToolId: string;
  onToolOpen(tool: WebToolMetadata): void;
}

const toolSectionContent: Record<ToolSectionKind, ToolSectionContent> = {
  favorites: { emptyText: 'No favorites yet.', icon: Star, title: 'Favorites' },
  recent: { emptyText: 'Tools you open appear here.', icon: Clock3, title: 'Recent' },
};

function groupByCategory(tools: WebToolMetadata[]): [ToolCategory, WebToolMetadata[]][] {
  const grouped = new Map<ToolCategory, WebToolMetadata[]>();

  for (const tool of tools) {
    grouped.set(tool.category, [...(grouped.get(tool.category) ?? []), tool]);
  }

  return [...grouped.entries()];
}

const DESKTOP_CATEGORIES = groupByCategory(webToolMetadata);

function ToolSection({ activeToolId, kind, tools, onToolOpen }: ToolSectionProps) {
  const { emptyText, icon: Icon, title } = toolSectionContent[kind];

  return (
    <section>
      <h2>
        <Icon size={14} />
        {title}
      </h2>
      {tools.map((tool) => (
        <DesktopToolLink
          active={tool.id === activeToolId}
          key={tool.id}
          tool={tool}
          onOpen={onToolOpen}
        />
      ))}
      {!tools.length && <p>{emptyText}</p>}
    </section>
  );
}

function CategorySection({ activeToolId, onToolOpen }: CategorySectionProps) {
  return (
    <section className={styles.categories}>
      <h2>Categories</h2>
      {DESKTOP_CATEGORIES.map(([category, tools]) => (
        <details key={category}>
          <summary>
            <CategoryIcon category={category} size={14} />
            <span>{category}</span>
            <small>{tools.length}</small>
          </summary>
          {tools.map((tool) => (
            <DesktopToolLink
              active={tool.id === activeToolId}
              key={tool.id}
              tool={tool}
              onOpen={onToolOpen}
            />
          ))}
        </details>
      ))}
    </section>
  );
}

export function DesktopSidebar({
  favoriteTools,
  recentTools,
  selectedTool,
  showRecent,
  onToolOpen,
}: DesktopSidebarProps) {
  const activeToolId = selectedTool.aliasOf ?? selectedTool.id;

  return (
    <aside
      aria-label="Desktop tool navigation"
      className={styles.sidebar}
      data-testid="desktop-sidebar"
    >
      <ToolSection
        activeToolId={activeToolId}
        kind="favorites"
        tools={favoriteTools}
        onToolOpen={onToolOpen}
      />
      {showRecent && (
        <ToolSection
          activeToolId={activeToolId}
          kind="recent"
          tools={recentTools}
          onToolOpen={onToolOpen}
        />
      )}
      <CategorySection activeToolId={activeToolId} onToolOpen={onToolOpen} />
    </aside>
  );
}

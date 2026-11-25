import type { SerializedToolDefinition } from '@devtoolora/core';
import { CloudOff, LockKeyhole } from 'lucide-react';
import { Link } from 'react-router';
import { Badge } from '@components';
import { ToolDocumentation, ToolFaq, ToolWorkspace, useToolContent } from '@devtoolora/tool-ui';
import { CategoryIcon, type CategoryMeta, FavoriteButton, getCategoryMeta } from '@/features/tools';
import type { WebToolMetadata } from '@/toolMetadata';
import { desktopToolRunnerHost } from '@/lib/toolRunnerHost';
import styles from './DesktopToolPanel.module.scss';
import { desktopPlatformActions } from '../../utils/desktopPlatformActions';
import { DesktopToolLink } from '../desktop-tool-link';

const eyebrowAccentClasses: Record<CategoryMeta['accent'], string | undefined> = {
  calibration: `${styles.eyebrow} ${styles.isCalibration}`,
  signal: styles.eyebrow,
};

interface DesktopToolPanelProps {
  continueWith: WebToolMetadata[];
  definition: SerializedToolDefinition | undefined;
  isFavorite: boolean;
  tool: WebToolMetadata;
  onDefinitionLoad(definition?: SerializedToolDefinition): void;
  onFavoriteToggle(): void;
  onToolOpen(tool: WebToolMetadata): void;
}

interface DesktopToolHeaderProps {
  isFavorite: boolean;
  tool: WebToolMetadata;
  onFavoriteToggle(): void;
}

interface DesktopToolBadgesProps {
  definition: SerializedToolDefinition;
}

interface DesktopToolHelpProps {
  definition: SerializedToolDefinition | undefined;
}

interface ContinueWithNavProps {
  tools: WebToolMetadata[];
  onToolOpen(tool: WebToolMetadata): void;
}

function DesktopToolHeader({ isFavorite, tool, onFavoriteToggle }: DesktopToolHeaderProps) {
  return (
    <header className={styles.toolHeader}>
      <CategoryIcon badge={tool.badge} category={tool.category} showBadge size={28} />
      <div>
        <p className={eyebrowAccentClasses[getCategoryMeta(tool.category).accent]}>
          {tool.category}
        </p>
        <h1>{tool.name}</h1>
        <p>{tool.description}</p>
        <div>
          <span>
            <LockKeyhole size={13} />
            Runs locally
          </span>
          <span>
            <CloudOff size={14} />
            Works offline
          </span>
        </div>
      </div>
      <FavoriteButton
        isFavorite={isFavorite}
        size="md"
        toolName={tool.name}
        variant="outline"
        onToggle={onFavoriteToggle}
      />
    </header>
  );
}

function DesktopToolBadges({ definition }: DesktopToolBadgesProps) {
  return (
    <div className={styles.toolBadges}>
      {definition.autoRun && (
        <Badge size="sm" variant="signal">
          Auto-run
        </Badge>
      )}
    </div>
  );
}

function DesktopToolHelp({ definition }: DesktopToolHelpProps) {
  const content = useToolContent(definition);

  return (
    <>
      {definition && (definition.textConversion || Boolean(content?.documentation?.length)) && (
        <details className={styles.conversionHelp} data-testid="conversion-help">
          <summary>How it works, examples &amp; limitations</summary>
          <ToolDocumentation content={content} variant="flat" />
        </details>
      )}
      {Boolean(content?.faq?.length) && (
        <details className={styles.desktopToolFaq}>
          <summary>Questions and answers</summary>
          <ToolFaq content={content} />
        </details>
      )}
    </>
  );
}

function ContinueWithNav({ tools, onToolOpen }: ContinueWithNavProps) {
  return (
    <nav aria-label="Continue with" className={styles.continueWith}>
      <span>Continue with</span>
      {tools.map((tool) => (
        <DesktopToolLink
          active={false}
          key={tool.id}
          tool={tool}
          variant="chip"
          onOpen={onToolOpen}
        />
      ))}
    </nav>
  );
}

export function DesktopToolPanel({
  continueWith,
  definition,
  isFavorite,
  tool,
  onDefinitionLoad,
  onFavoriteToggle,
  onToolOpen,
}: DesktopToolPanelProps) {
  return (
    <section className={styles.workspace} data-testid="desktop-workspace">
      <div className={styles.toolStage}>
        <DesktopToolHeader
          isFavorite={isFavorite}
          tool={tool}
          onFavoriteToggle={onFavoriteToggle}
        />
        {definition && definition.autoRun && <DesktopToolBadges definition={definition} />}
        <ToolWorkspace
          backLink={<Link to="/desktop">Back to tools</Link>}
          host={desktopToolRunnerHost}
          key={tool.id}
          metadataId={tool.id}
          platformActions={desktopPlatformActions}
          surface="desktop"
          onDefinitionLoad={onDefinitionLoad}
        />
      </div>
      <DesktopToolHelp definition={definition} />
      {Boolean(continueWith.length) && (
        <ContinueWithNav tools={continueWith} onToolOpen={onToolOpen} />
      )}
    </section>
  );
}

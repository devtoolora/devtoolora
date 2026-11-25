import type { SerializedToolDefinition, ToolContent } from '@devtoolora/core';
import { ArrowLeft, CloudOff, LockKeyhole } from 'lucide-react';
import type { ReactElement } from 'react';
import { Link } from 'react-router';
import { Badge } from '@components';
import { ToolDocumentation, ToolFaq } from '@devtoolora/tool-ui';
import { CategoryIcon, type CategoryMeta, FavoriteButton, getCategoryMeta } from '@/features/tools';
import type { WebToolMetadata } from '@/toolMetadata';
import styles from './ToolDetailSections.module.scss';

const eyebrowAccentClasses: Record<CategoryMeta['accent'], string | undefined> = {
  calibration: `${styles.eyebrow} ${styles.isCalibration}`,
  signal: styles.eyebrow,
};

interface ToolModeBadgesProps {
  definition: SerializedToolDefinition;
}

interface ToolDetailHeaderProps {
  definition: SerializedToolDefinition | undefined;
  isFavorite: boolean;
  tool: WebToolMetadata;
  onFavoriteToggle(): void;
}

interface ToolInformationProps {
  content: ToolContent | undefined;
  hasTextConversion: boolean;
  toolName: string;
}

interface ToolFaqSectionProps {
  content: ToolContent | undefined;
  toolName: string;
}

interface RelatedToolsSectionProps {
  catalogHref: string;
  tools: WebToolMetadata[];
}

function ToolModeBadges({ definition }: ToolModeBadgesProps): ReactElement {
  return (
    <>
      {definition.autoRun && (
        <Badge size="sm" variant="signal">
          Auto-run
        </Badge>
      )}
    </>
  );
}

export function ToolNotFound(): ReactElement {
  return (
    <main className={`${styles.notFound} page-frame`}>
      <p className={styles.eyebrow}>404 · No signal</p>
      <h1>Tool not found.</h1>
      <p>This tool route is not available.</p>
      <Link to="/tools">
        <ArrowLeft size={16} />
        Browse all tools
      </Link>
    </main>
  );
}

export function ToolDetailHeader({
  definition,
  isFavorite,
  tool,
  onFavoriteToggle,
}: ToolDetailHeaderProps): ReactElement {
  return (
    <header className={styles.toolDetailHeader}>
      <div>
        <div className={styles.toolDetailHeadingRow}>
          <CategoryIcon badge={tool.badge} category={tool.category} showBadge size={28} />
          <div>
            <p className={eyebrowAccentClasses[getCategoryMeta(tool.category).accent]}>
              &gt; {tool.category}
            </p>
            <h1>{tool.name}</h1>
          </div>
        </div>
        <p>{tool.description}</p>
        <div className={styles.detailTrust}>
          <span>
            <LockKeyhole size={14} />
            Runs locally
          </span>
          <span>
            <CloudOff size={15} />
            Works offline
          </span>
        </div>
        {definition && definition.autoRun && (
          <div>
            <ToolModeBadges definition={definition} />
          </div>
        )}
      </div>
      <FavoriteButton
        isFavorite={isFavorite}
        size="lg"
        toolName={tool.name}
        variant="outline"
        onToggle={onFavoriteToggle}
      />
    </header>
  );
}

export function ToolInformation({
  content,
  hasTextConversion,
  toolName,
}: ToolInformationProps): ReactElement {
  let informationTitle = 'Private by design.';

  if (content?.documentation?.length) informationTitle = 'About this tool.';
  else if (hasTextConversion) informationTitle = 'Choose a direction and try an example.';

  return (
    <section className={styles.toolInformation} data-testid="tool-information">
      <article>
        <ToolDocumentation
          content={content}
          fallbackHelp={`${toolName} runs in a dedicated browser worker. Your input stays on this device.`}
          header={
            <div>
              <p className={styles.eyebrow} data-testid="eyebrow">
                {content?.documentation?.length ? 'Tool guide' : 'How it works'}
              </p>
              <h2>{informationTitle}</h2>
            </div>
          }
          key={content ? 'content' : 'fallback'}
        />
      </article>
    </section>
  );
}

export function ToolFaqSection({ content, toolName }: ToolFaqSectionProps): ReactElement {
  return (
    <section aria-labelledby="tool-faq-title" className={styles.toolFaq}>
      <p className={styles.eyebrow}>FAQ</p>
      <h2 id="tool-faq-title">Questions about {toolName}</h2>
      <ToolFaq content={content} />
    </section>
  );
}

export function RelatedToolsSection({
  catalogHref,
  tools,
}: RelatedToolsSectionProps): ReactElement {
  return (
    <section aria-label="Continue with" className={styles.relatedTools}>
      <p className={styles.eyebrow}>Continue with</p>
      <div>
        {tools.map((tool) => (
          <Link key={tool.id} state={{ catalogHref }} to={`/tools/${tool.slug}`}>
            <strong>{tool.name}</strong>
            <small>{tool.description}</small>
          </Link>
        ))}
      </div>
    </section>
  );
}

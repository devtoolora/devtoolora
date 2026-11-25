import type { SerializedToolDefinition } from '@devtoolora/core';
import { ArrowLeft } from 'lucide-react';
import { useState, type ReactElement } from 'react';
import {
  Link,
  type ClientLoaderFunctionArgs,
  type LoaderFunctionArgs,
  type MetaFunction,
  useLoaderData,
  useLocation,
  useParams,
} from 'react-router';
// The detail sections load Badge first, which keeps the original stylesheet order.
import {
  RelatedToolsSection,
  ToolDetailHeader,
  ToolFaqSection,
  ToolInformation,
  ToolNotFound,
} from '@/features/tool-detail';
import { Breadcrumbs } from '@components';
import { ToolWorkspace, useToolContent } from '@devtoolora/tool-ui';
import { catalogOrigin, useFavorites } from '@/features/tools';
import { routeMeta } from '../lib/seo';
import { webToolRunnerHost } from '../lib/toolRunnerHost';
import { webToolAliases, webToolMetadata } from '../toolMetadata.generated';
import styles from './tool-detail.module.scss';
import { toolGuide, type ToolGuide } from './toolGuide.server';

const toolRoutes = [...webToolMetadata, ...webToolAliases];

export async function loader({ params }: LoaderFunctionArgs): Promise<{ guide: ToolGuide | null }> {
  const tool = toolRoutes.find((item) => item.slug === params.slug);

  return { guide: tool ? await toolGuide(tool.id) : null };
}

// An unknown tool or an offline client navigation has no prerendered data file.
export async function clientLoader({
  serverLoader,
}: ClientLoaderFunctionArgs): Promise<{ guide: ToolGuide | null }> {
  try {
    return await serverLoader<typeof loader>();
  } catch {
    return { guide: null };
  }
}

export const meta: MetaFunction<typeof loader> = ({ loaderData, params }) => {
  const tool = toolRoutes.find((item) => item.slug === params.slug);

  if (!tool)
    return [{ title: 'Tool not found — Dev Toolora' }, { name: 'robots', content: 'noindex' }];

  const meta = routeMeta(
    `${tool.name} — Dev Toolora`,
    tool.description,
    `/tools/${tool.aliasOf ?? tool.slug}`,
  );
  const faq = loaderData?.guide?.faq ?? [];

  if (!faq.length) return meta;

  return [
    ...meta,
    {
      'script:ld+json': {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: faq.map(({ answer, question }) => ({
          '@type': 'Question',
          acceptedAnswer: { '@type': 'Answer', text: answer },
          name: question,
        })),
      },
    },
  ];
};

export default function ToolDetailRoute(): ReactElement {
  const { slug } = useParams();
  const location = useLocation();
  const metadata = toolRoutes.find((tool) => tool.slug === slug);
  const favorites = useFavorites();
  const [definition, setDefinition] = useState<SerializedToolDefinition>();
  const { guide } = useLoaderData<typeof loader>();
  const content = useToolContent(guide ? undefined : metadata) ?? guide ?? undefined;
  const information = definition ?? guide?.definition;
  const catalogHref = catalogOrigin(location.state);

  if (!metadata) return <ToolNotFound />;

  const related = (information?.relatedToolIds ?? [])
    .map((id) => webToolMetadata.find((tool) => tool.id === id))
    .filter((tool) => tool !== undefined);

  return (
    <main className={`${styles.toolDetail} page-frame`}>
      <Breadcrumbs
        items={[
          { label: 'Home', to: '/' },
          { label: 'Tools', to: catalogHref },
          {
            label: metadata.category,
            to: `/tools?category=${encodeURIComponent(metadata.category)}`,
          },
          { label: metadata.name },
        ]}
      />
      <ToolDetailHeader
        definition={information}
        isFavorite={favorites.favoriteIds.has(metadata.aliasOf ?? metadata.id)}
        tool={metadata}
        onFavoriteToggle={() => favorites.onFavoriteToggle(metadata.id)}
      />

      <Link className={styles.backToResults} to={catalogHref}>
        <ArrowLeft size={15} />
        Back to results
      </Link>

      <ToolWorkspace
        backLink={<Link to={catalogHref}>Back to tools</Link>}
        host={webToolRunnerHost}
        initialDefinition={guide?.definition}
        metadataId={metadata.id}
        shareSettings
        onDefinitionLoad={setDefinition}
      />

      <ToolInformation
        content={content}
        hasTextConversion={Boolean(information?.textConversion)}
        toolName={metadata.name}
      />

      {Boolean(content?.faq?.length) && (
        <ToolFaqSection content={content} toolName={metadata.name} />
      )}

      {related.length > 0 && <RelatedToolsSection catalogHref={catalogHref} tools={related} />}
    </main>
  );
}

import type { HtmlPreviewNode } from '@devtoolora/core';
import { createElement, type ReactElement, type ReactNode } from 'react';
import styles from './HtmlPreview.module.scss';

type HtmlPreviewProps = { label?: string; nodes: HtmlPreviewNode[] };

function renderNode(node: HtmlPreviewNode, index: number): ReactNode {
  if (node.tag === 'text') return node.text;

  if (node.tag === 'image') {
    return (
      <span className={styles.image} key={index}>
        <strong>Image: {node.text || '(no alt text)'}</strong>
        <small>{node.target}</small>
      </span>
    );
  }

  const children = node.children?.map(renderNode) ?? node.text;

  if (node.tag === 'link') {
    return (
      <span className={styles.link} key={index} title={node.target}>
        {children}
      </span>
    );
  }

  return createElement(
    node.tag,
    {
      key: index,
      start: node.tag === 'ol' ? node.start : undefined,
      style: node.align ? { textAlign: node.align } : undefined,
    },
    children,
  );
}

export function HtmlPreview({
  label = 'Rendered Markdown',
  nodes,
}: HtmlPreviewProps): ReactElement {
  return (
    <section aria-label={label} className={styles.preview}>
      <p className={styles.notice}>Local preview · links inactive · images not fetched</p>

      <article className={styles.document}>
        {nodes.length ? (
          nodes.map(renderNode)
        ) : (
          <p className={styles.empty}>Empty Markdown produces empty HTML.</p>
        )}
      </article>
    </section>
  );
}

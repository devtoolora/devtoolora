import type { ToolContent } from '@devtoolora/core';
import type { ReactElement } from 'react';
import styles from './ToolFaq.module.scss';

type ToolFaqProps = { content?: ToolContent };

export function ToolFaq({ content }: ToolFaqProps): ReactElement | null {
  if (!content?.faq?.length) return null;

  return (
    <div className={styles.faq}>
      {content.faq.map(({ answer, question }) => (
        <details className={styles.item} key={question}>
          <summary>{question}</summary>
          <p>{answer}</p>
        </details>
      ))}
    </div>
  );
}

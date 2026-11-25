import type { ToolContent } from '@devtoolora/core';
import { Fragment, type ReactElement, type ReactNode } from 'react';
import { Accordion, type AccordionItemData } from '../../../ui';
import styles from './ToolDocumentation.module.scss';

type ToolDocumentationProps = {
  content?: ToolContent;
  fallbackHelp?: string;
  header?: ReactNode;
  variant?: 'accordion' | 'flat';
};

type DocumentationSection = {
  content: string | string[];
  title?: string;
};

function DocumentationBody({ content }: Pick<DocumentationSection, 'content'>): ReactElement {
  if (Array.isArray(content))
    return (
      <ul className={styles.list}>
        {content.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    );

  return (
    <>
      {content.split('\n\n').map((paragraph) => (
        <p className={styles.content} key={paragraph}>
          {paragraph}
        </p>
      ))}
    </>
  );
}

function documentationSections(
  content: ToolContent | undefined,
  help: string | undefined,
  hasDocumentation: boolean,
): DocumentationSection[] {
  const rawSections: Array<{ content?: string | string[]; title?: string }> = [
    ...(content?.documentation ?? []),
    { content: help, title: hasDocumentation ? 'How to use it' : undefined },
    { content: content?.examples, title: 'Examples' },
    { content: content?.notes, title: 'Notes' },
  ];

  return rawSections.filter((section): section is DocumentationSection =>
    Boolean(section.content && section.content.length > 0),
  );
}

export function ToolDocumentation({
  content,
  fallbackHelp,
  header,
  variant = 'accordion',
}: ToolDocumentationProps): ReactElement {
  const help = content?.help ?? fallbackHelp;
  const hasDocumentation = Boolean(content?.documentation?.length);
  const validSections = documentationSections(content, help, hasDocumentation);

  if (variant === 'flat') {
    return (
      <>
        {header && <div>{header}</div>}
        {validSections.map(({ content, title }) => (
          <Fragment key={title ?? 'help'}>
            {title && <h3>{title}</h3>}

            <DocumentationBody content={content} />
          </Fragment>
        ))}
      </>
    );
  }

  const items: AccordionItemData[] = validSections.map(({ content, title }, index) => ({
    content: <DocumentationBody content={content} />,
    id: title ? title.toLowerCase().replace(/[^a-z0-9]+/g, '-') : `section-${index}`,
    title: title ?? (hasDocumentation ? 'How to use it' : 'How it works'),
  }));

  return <Accordion header={header} items={items} />;
}

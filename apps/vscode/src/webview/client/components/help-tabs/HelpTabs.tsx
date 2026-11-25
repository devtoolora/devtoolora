import type { SerializedToolDefinition, ToolContent, ToolFaq } from '@devtoolora/core';
import { useToolContent } from '@devtoolora/tool-ui';
import { useEffect, useRef, useState, type KeyboardEvent, type ReactElement } from 'react';
import styles from './HelpTabs.module.scss';

type HelpSection = { content: string | string[] | ToolFaq[]; title: string };

type HelpTabsProps = {
  isOpen: boolean;
  tool: SerializedToolDefinition;
  onOpenChange(open: boolean): void;
};

function helpSections(content: ToolContent | undefined): HelpSection[] {
  const sections: HelpSection[] = [];

  const add = (title: string, content: string | string[] | undefined) => {
    if (content && content.length > 0) sections.push({ content, title });
  };

  for (const section of content?.documentation ?? []) add(section.title, section.content);
  add('How it works', content?.help);
  add('Examples', content?.examples);
  add('Notes', content?.notes);
  if (content?.faq?.length) sections.push({ content: content.faq, title: 'FAQ' });

  return sections;
}

function isFaq(content: HelpSection['content']): content is ToolFaq[] {
  return Array.isArray(content) && typeof content[0] === 'object';
}

function SectionBody({ section }: { section: HelpSection }): ReactElement {
  if (isFaq(section.content)) {
    return (
      <dl className={styles.faq}>
        {section.content.map((item) => (
          <div key={item.question}>
            <dt>{item.question}</dt>
            <dd>{item.answer}</dd>
          </div>
        ))}
      </dl>
    );
  }

  if (Array.isArray(section.content)) {
    return (
      <ul>
        {section.content.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    );
  }

  return <>{section.content}</>;
}

const tabKeys: Record<string, (index: number, last: number) => number> = {
  ArrowLeft: (index, last) => (index === 0 ? last : index - 1),
  ArrowRight: (index, last) => (index === last ? 0 : index + 1),
  End: (_index, last) => last,
  Home: () => 0,
};

export function HelpTabs({ isOpen, tool, onOpenChange }: HelpTabsProps): ReactElement | null {
  const sections = helpSections(useToolContent(tool));
  const [selected, setSelected] = useState(0);
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  useEffect(() => setSelected(0), [tool.id]);
  const current = sections[Math.min(selected, sections.length - 1)];

  if (!current) return null;

  const panelId = 'tool-help-panel';

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const move = tabKeys[event.key];

    if (!move) return;

    event.preventDefault();
    const next = move(index, sections.length - 1);

    setSelected(next);
    tabRefs.current[next]?.focus();
  };

  return (
    <details
      className={styles.details}
      open={isOpen}
      onToggle={(event) => onOpenChange(event.currentTarget.open)}
    >
      <summary className={styles.summary}>Tool info</summary>
      {sections.length > 1 && (
        <div aria-label="Tool documentation" className={styles.tabs} role="tablist">
          {sections.map((section, index) => (
            <button
              aria-controls={panelId}
              aria-selected={index === selected}
              className={styles.tab}
              id={`tool-help-tab-${index}`}
              key={section.title}
              ref={(element) => {
                tabRefs.current[index] = element;
              }}
              role="tab"
              tabIndex={index === selected ? 0 : -1}
              type="button"
              onClick={() => setSelected(index)}
              onKeyDown={(event) => handleKeyDown(event, index)}
            >
              {section.title}
            </button>
          ))}
        </div>
      )}
      <div
        aria-labelledby={sections.length > 1 ? `tool-help-tab-${selected}` : undefined}
        className={`${styles.body} ${current.title === 'Examples' ? styles.code : ''}`}
        id={panelId}
        role={sections.length > 1 ? 'tabpanel' : undefined}
        tabIndex={sections.length > 1 ? 0 : undefined}
      >
        <SectionBody section={current} />
      </div>
    </details>
  );
}

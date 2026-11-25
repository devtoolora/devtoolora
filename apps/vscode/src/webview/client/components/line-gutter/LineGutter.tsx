import { useEffect, useRef, type ReactElement, type RefObject } from 'react';
import styles from './LineGutter.module.scss';

type LineGutterProps = {
  scrollRef: RefObject<HTMLElement | null>;
  text: string;
  variant: 'input' | 'output';
};

const variantClasses: Record<LineGutterProps['variant'], string | undefined> = {
  input: styles.input,
  output: styles.output,
};

export function LineGutter({ scrollRef, text, variant }: LineGutterProps): ReactElement {
  const gutterRef = useRef<HTMLDivElement>(null);
  const lineCount = text.length > 0 ? text.split('\n').length : 1;

  useEffect(() => {
    const content = scrollRef.current;

    if (!content) return;

    const syncScroll = () => {
      if (gutterRef.current) gutterRef.current.scrollTop = content.scrollTop;
    };

    content.addEventListener('scroll', syncScroll);

    return () => content.removeEventListener('scroll', syncScroll);
  }, [scrollRef]);

  return (
    <div
      aria-hidden="true"
      className={`${styles.gutter} ${variantClasses[variant]}`}
      data-testid="line-gutter"
      ref={gutterRef}
    >
      {Array.from({ length: lineCount }, (_, index) => (
        <span data-testid="line-number" key={index}>
          {index + 1}
        </span>
      ))}
    </div>
  );
}

import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactElement,
  type ReactNode,
} from 'react';
import {
  clampEditorSplitPercent,
  MAX_EDITOR_SPLIT_PERCENT,
  MIN_EDITOR_SPLIT_PERCENT,
} from '../../utils/state';
import styles from './SplitPane.module.scss';

type SplitPaneProps = {
  end: ReactNode;
  percent: number;
  start: ReactNode;
  onPercentChange(percent: number): void;
};

const keyboardSteps: Record<string, (percent: number) => number> = {
  ArrowLeft: (percent) => percent - 2,
  ArrowRight: (percent) => percent + 2,
  End: () => MAX_EDITOR_SPLIT_PERCENT,
  Home: () => MIN_EDITOR_SPLIT_PERCENT,
};

export function SplitPane({ end, percent, start, onPercentChange }: SplitPaneProps): ReactElement {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isResizing, setIsResizing] = useState(false);

  useEffect(() => {
    if (!isResizing) return;

    const handlePointerMove = (event: MouseEvent) => {
      const bounds = containerRef.current?.getBoundingClientRect();

      if (!bounds || bounds.width <= 0) return;

      onPercentChange(
        clampEditorSplitPercent(((event.clientX - bounds.left) / bounds.width) * 100),
      );
    };

    const stop = () => setIsResizing(false);

    document.body.classList.add('is-resizing-editor-split');
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', stop);

    return () => {
      document.body.classList.remove('is-resizing-editor-split');
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', stop);
    };
  }, [isResizing, onPercentChange]);

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const step = keyboardSteps[event.key];

    if (!step) return;

    event.preventDefault();
    onPercentChange(clampEditorSplitPercent(step(percent)));
  };

  return (
    <div
      className={styles.pane}
      ref={containerRef}
      style={{ '--editor-split': `${percent}%` } as CSSProperties}
    >
      {start}
      <div
        aria-label="Resize input and output panes"
        aria-orientation="vertical"
        aria-valuemax={MAX_EDITOR_SPLIT_PERCENT}
        aria-valuemin={MIN_EDITOR_SPLIT_PERCENT}
        aria-valuenow={percent}
        className={styles.separator}
        role="separator"
        tabIndex={0}
        onKeyDown={handleKeyDown}
        onPointerDown={(event) => {
          event.preventDefault();
          setIsResizing(true);
        }}
      />
      {end}
    </div>
  );
}

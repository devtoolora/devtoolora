import type { ToolRuntime } from '@devtoolora/core';
import type { ReactElement } from 'react';
import type { RuntimeProgress } from '../../hooks/useRuntimeWorker';
import styles from './RuntimeStatus.module.scss';

type RuntimeStatusVariant = 'error' | 'loading';

type RuntimeStatusProps =
  | { message: string; variant: 'error' }
  | { progress?: RuntimeProgress; runtime: ToolRuntime; variant: 'loading' };

const variantClasses: Record<RuntimeStatusVariant, string | undefined> = {
  error: styles.error,
  loading: styles.loading,
};

const runtimeLabels: Record<ToolRuntime, string> = {
  heic: 'HEIC decoder',
  ocr: 'OCR engine',
};

const megabytes = (bytes: number): string => (bytes / 1_000_000).toFixed(1);

export function RuntimeStatus(props: RuntimeStatusProps): ReactElement {
  const className = `${styles.status} ${variantClasses[props.variant]}`;

  if (props.variant === 'error') {
    return (
      <div className={className} role="alert">
        <p>{props.message}</p>
      </div>
    );
  }

  const { progress } = props;

  // Only the label is live; announcing every progress chunk floods screen readers.
  return (
    <div className={className}>
      <p>
        <span role="status">Loading {runtimeLabels[props.runtime]}…</span>
        {progress && ` ${megabytes(progress.loaded)} of ${megabytes(progress.total)} MB`}
      </p>
      <progress max={progress?.total} value={progress?.loaded} />
    </div>
  );
}

import { Button, RuntimeStatus, type useToolRunner } from '@devtoolora/tool-ui';
import { RotateCw } from 'lucide-react';
import type { ReactElement } from 'react';
import styles from './RunnerStatus.module.scss';

type RunnerStatusProps = {
  hasTool: boolean;
  runner: ReturnType<typeof useToolRunner>;
};

export function RunnerStatus({ hasTool, runner }: RunnerStatusProps): ReactElement | null {
  if (runner.runtime.status === 'unavailable') {
    return (
      <div className={styles.runtime}>
        <RuntimeStatus message={runner.runtime.message} variant="error" />
      </div>
    );
  }

  if (runner.definitionStatus === 'loading') {
    return <div className={styles.loading}>Loading local tool…</div>;
  }

  if (runner.definitionStatus !== 'error' && hasTool) return null;

  return (
    <div className={styles.failure} role="alert">
      <p className={styles.eyebrow}>Worker unavailable</p>
      <h2>{hasTool ? 'The local worker stopped.' : 'This tool could not be loaded.'}</h2>
      <p>
        {runner.definitionError ||
          'The browser worker catalog does not contain this tool definition.'}
      </p>
      <Button size="sm" variant="secondary" onClick={runner.retryWorker}>
        <RotateCw size={15} />
        Retry
      </Button>
    </div>
  );
}

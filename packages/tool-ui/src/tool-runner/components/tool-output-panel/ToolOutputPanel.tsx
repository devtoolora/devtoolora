import { type ReactElement } from 'react';
import styles from './ToolOutputPanel.module.scss';
import { OutputBody } from './OutputBody';
import { OutputHeadingActions } from './OutputHeader';
import { type ToolOutputPanelProps } from './types';
import type { ToolPanelDensity } from '../../types';
import { useOutputActions } from './useOutputActions';

const densityClasses: Record<ToolPanelDensity, string> = {
  comfortable: '',
  compact: styles.outputPanelCompact ?? '',
};

export function ToolOutputPanel(props: ToolOutputPanelProps): ReactElement {
  const { actions, isRunning, isStale = false, outputLabel, platformActions, result } = props;
  const { resultActions, toolName, onReverse } = props;
  const freshResult = isStale ? undefined : result;
  const artifacts = [
    ...(freshResult?.artifact ? [freshResult.artifact] : []),
    ...(freshResult?.artifacts ?? []),
  ];
  const canSaveText = Boolean(freshResult && !artifacts.length && resultActions?.includes('save'));
  const output = useOutputActions(freshResult, platformActions, toolName);

  return (
    <section
      aria-busy={isRunning ? 'true' : 'false'}
      aria-labelledby="output-title"
      className={`${styles.outputPanel} ${densityClasses[props.density ?? 'comfortable']} workspace-panel`}
      data-testid="output-panel"
    >
      <div className={styles.panelHeading}>
        <div>
          <span>Output</span>
          <h2 id="output-title">{outputLabel ?? 'Result'}</h2>
        </div>
        <OutputHeadingActions
          actions={actions}
          canSaveText={canSaveText}
          result={freshResult}
          resultActions={resultActions}
          onCopy={() => void output.handleCopy()}
          onReverse={onReverse}
          onSaveText={output.handleSaveText}
        />
      </div>
      <OutputBody artifacts={artifacts} freshResult={freshResult} output={output} panel={props} />
    </section>
  );
}

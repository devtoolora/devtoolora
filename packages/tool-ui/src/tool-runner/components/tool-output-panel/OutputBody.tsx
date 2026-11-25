import type { ToolResult } from '@devtoolora/core';
import { Check, Download, X } from 'lucide-react';
import { type ReactElement, type ReactNode, type Ref } from 'react';
import { Button } from '../../../ui';
import styles from './ToolOutputPanel.module.scss';
import {
  HtmlPreview,
  JsonDiffPreview,
  JsonTablePreview,
  JsonTreePreview,
  RegexPreview,
  TextDiffPreview,
} from '../../previews';
import { textStatsLabel } from '../../utils/textStats';
import { OutputStatus } from './OutputHeader';
import { type ToolOutputPanelProps } from './types';
import { type OutputActions, type ToolArtifact } from './useOutputActions';

function outputLabel(result: ToolResult): string | undefined {
  if (result.asciiArt) return 'ASCII art preview';

  return result.noWrap ? 'Text output' : undefined;
}

function showsPlainText(result: ToolResult | undefined): boolean {
  return Boolean(
    result?.text &&
    !result.jsonTree &&
    !result.jsonDiff &&
    !result.jsonTable &&
    !result.regex &&
    !result.htmlPreview &&
    !result.textDiff &&
    !result.verdict,
  );
}

type ResultViewsProps = {
  outputGutter?: ReactNode;
  outputRef?: Ref<HTMLPreElement>;
  result?: ToolResult;
  showsText: boolean;
  onCopyTreeText(text: string): Promise<void>;
};

function ResultViews({
  outputGutter,
  outputRef,
  result,
  showsText,
  onCopyTreeText,
}: ResultViewsProps): ReactElement {
  return (
    <>
      {result?.jsonTree && (
        <JsonTreePreview
          expandedLevels={result.jsonTree.expandedLevels}
          nodes={result.jsonTree.nodes}
          onCopyText={onCopyTreeText}
        />
      )}
      {result?.jsonDiff && <JsonDiffPreview changes={result.jsonDiff.changes} />}
      {result?.jsonTable && <JsonTablePreview table={result.jsonTable} />}
      {result?.regex && <RegexPreview report={result.regex} />}
      {result?.htmlPreview && (
        <HtmlPreview label={result.htmlPreview.label} nodes={result.htmlPreview.nodes} />
      )}
      {result?.textDiff && <TextDiffPreview report={result.textDiff} />}
      {result?.text && showsText && (
        <div className={styles.editorPane}>
          {outputGutter}
          <pre
            aria-label={outputLabel(result)}
            data-ascii-art={result.asciiArt ? 'true' : undefined}
            data-no-wrap={result.noWrap ? 'true' : undefined}
            ref={outputRef}
            role={outputLabel(result) ? 'region' : undefined}
            tabIndex={0}
          >
            <code>{result.text}</code>
          </pre>
        </div>
      )}
      {result?.text && showsText && (
        <small className={styles.outputStats} data-testid="output-stats">
          {textStatsLabel(result.text)}
        </small>
      )}
    </>
  );
}

type ArtifactDownloadsProps = {
  artifacts: ToolArtifact[];
  onDownload(artifact: ToolArtifact): void;
};

function ArtifactDownloads({ artifacts, onDownload }: ArtifactDownloadsProps): ReactElement {
  return (
    <div className={styles.artifactList} data-testid="artifact-list">
      {artifacts.map((artifact, index) => (
        <Button
          key={`${artifact.fileName}-${index}`}
          size="sm"
          variant="secondary"
          onClick={() => onDownload(artifact)}
        >
          <Download size={15} />
          Download {artifact.fileName}
        </Button>
      ))}
    </div>
  );
}

function VerdictBadge({ verdict }: { verdict: NonNullable<ToolResult['verdict']> }): ReactElement {
  const Icon = verdict === 'match' ? Check : X;

  return (
    <p className={styles.verdict} data-verdict={verdict} role="status">
      <Icon aria-hidden size={15} />
      {verdict === 'match' ? 'Match' : 'No match'}
    </p>
  );
}

function BatchResult({ batch }: { batch: NonNullable<ToolResult['batch']> }): ReactElement {
  return (
    <div className={styles.batchResult} data-testid="batch-result">
      <p className={styles.resultSummary} data-testid="result-summary">
        {batch.succeeded} of {batch.total} completed.
      </p>
      {!!batch.failed.length && (
        <ul>
          {batch.failed.map((failure) => (
            <li key={failure.name}>
              <strong>{failure.name}</strong>: {failure.message}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

type OutputBodyProps = {
  artifacts: ToolArtifact[];
  freshResult?: ToolResult;
  output: OutputActions;
  panel: Pick<
    ToolOutputPanelProps,
    | 'canRetry'
    | 'error'
    | 'footer'
    | 'isRunning'
    | 'outputGutter'
    | 'outputRef'
    | 'result'
    | 'shouldRevealError'
    | 'toolName'
    | 'visualPreview'
    | 'onRetry'
  >;
};

export function OutputBody({
  artifacts,
  freshResult,
  output,
  panel,
}: OutputBodyProps): ReactElement {
  return (
    <div className={`${styles.panelBody} panel-body`}>
      <p aria-live="polite" className={styles.srOnly}>
        {output.copyStatus || output.saveStatus}
      </p>
      {panel.visualPreview}
      <OutputStatus
        canRetry={panel.canRetry}
        error={panel.error}
        hasResult={Boolean(panel.result)}
        isRunning={panel.isRunning}
        shouldRevealError={panel.shouldRevealError}
        onRetry={panel.onRetry}
      />
      {panel.result?.previewDataUri && (
        <img
          alt={`${panel.toolName} preview`}
          aria-busy={freshResult ? undefined : true}
          className={styles.resultPreview}
          data-testid="result-preview"
          src={panel.result.previewDataUri}
        />
      )}
      {freshResult?.summary && (
        <p className={styles.resultSummary} data-testid="result-summary">
          {freshResult.summary}
        </p>
      )}
      {freshResult?.verdict && <VerdictBadge verdict={freshResult.verdict} />}
      <ResultViews
        outputGutter={panel.outputGutter}
        outputRef={panel.outputRef}
        result={freshResult}
        showsText={showsPlainText(freshResult)}
        onCopyTreeText={output.handleCopyTreeText}
      />
      {!!artifacts.length && (
        <ArtifactDownloads artifacts={artifacts} onDownload={output.handleArtifactDownload} />
      )}
      {freshResult?.batch && <BatchResult batch={freshResult.batch} />}
      {freshResult && panel.footer}
    </div>
  );
}

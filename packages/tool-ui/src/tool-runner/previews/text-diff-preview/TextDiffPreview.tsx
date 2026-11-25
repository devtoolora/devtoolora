import type { ToolResult } from '@devtoolora/core';
import { useEffect, useState, type ReactElement, type ReactNode } from 'react';
import { Button } from '../../../ui';
import styles from './TextDiffPreview.module.scss';

type Report = NonNullable<ToolResult['textDiff']>;
type Line = NonNullable<Report['rows'][number]['before']>;
type TextDiffPreviewProps = { report: Report };
type DiffLineProps = { line?: Line; showEnding: boolean; side: 'After' | 'Before' };

function DiffLine({ line, showEnding, side }: DiffLineProps): ReactElement {
  if (!line)
    return <div className={styles.missing}>No corresponding {side.toLowerCase()} line</div>;

  const highlight = line.highlight;
  let content: ReactNode = line.text || '(empty line)';

  if (highlight && line.text) {
    content = (
      <>
        {line.text.slice(0, highlight.start)}
        <mark>{line.text.slice(highlight.start, highlight.end)}</mark>
        {line.text.slice(highlight.end)}
      </>
    );
  }

  return (
    <div className={styles.line} data-side={side}>
      <h4>
        {side} {line.number}
        {showEnding && ` · ${line.ending === 'none' ? 'No newline' : line.ending}`}
      </h4>
      <pre>{content}</pre>
    </div>
  );
}

function rowHeading(row: Report['rows'][number]): string {
  const equivalent =
    row.kind === 'unchanged' &&
    (row.before?.text !== row.after?.text || row.before?.ending !== row.after?.ending);

  if (equivalent) return 'Equivalent under ignore options';

  return `${row.kind.charAt(0).toUpperCase()}${row.kind.slice(1)}`;
}

export function TextDiffPreview({ report }: TextDiffPreviewProps): ReactElement {
  const [changesOnly, setChangesOnly] = useState(false);
  const [limit, setLimit] = useState(100);
  const showEnding = report.showLineEndings !== false;
  const rows = changesOnly ? report.rows.filter((row) => row.kind !== 'unchanged') : report.rows;

  useEffect(() => {
    setChangesOnly(false);
    setLimit(100);
  }, [report]);

  return (
    <section aria-label="Text difference report" className={styles.report}>
      <label className={styles.filter}>
        Visible rows
        <select
          value={changesOnly ? 'changes' : 'all'}
          onChange={(event) => {
            setChangesOnly(event.target.value === 'changes');
            setLimit(100);
          }}
        >
          <option value="all">All rows</option>
          <option value="changes">Changes only</option>
        </select>
      </label>

      <p>
        {Math.min(limit, rows.length)} of {rows.length} visible rows · export includes all rows
      </p>
      {report.rows.length === 0 && <p>Both texts are empty. No differences.</p>}
      {report.rows.length > 0 && rows.length === 0 && (
        <p>No changed rows under the selected comparison options.</p>
      )}
      <div className={styles.rows}>
        {rows.slice(0, limit).map((row, index) => {
          return (
            <article className={styles.row} data-kind={row.kind} key={index}>
              <h3>{rowHeading(row)}</h3>
              <div className={report.layout === 'split' ? styles.split : styles.unified}>
                <DiffLine line={row.before} showEnding={showEnding} side="Before" />
                <DiffLine line={row.after} showEnding={showEnding} side="After" />
              </div>
            </article>
          );
        })}
      </div>

      {rows.length > limit && (
        <Button
          size="sm"
          variant="secondary"
          onClick={() => setLimit((previous) => previous + 100)}
        >
          Show more rows
        </Button>
      )}
    </section>
  );
}

import type { ToolResult } from '@devtoolora/core';
import { Button } from '../../../ui';
import { Fragment, useEffect, useState, type ReactElement } from 'react';
import styles from './RegexPreview.module.scss';

type RegexPreviewProps = { report: NonNullable<ToolResult['regex']> };

export function RegexPreview({ report }: RegexPreviewProps): ReactElement {
  const [limit, setLimit] = useState(100);

  useEffect(() => setLimit(100), [report]);
  const source: ReactElement[] = [];
  let cursor = 0;

  report.matches.forEach((match, index) => {
    source.push(
      <Fragment key={`text-${index}`}>{report.source.slice(cursor, match.index)}</Fragment>,
    );

    source.push(
      <mark key={`match-${index}`} title={`Match ${index + 1}: ${match.index}–${match.end}`}>
        {match.match || '∅'}
      </mark>,
    );

    cursor = match.end;
  });

  source.push(<Fragment key="tail">{report.source.slice(cursor)}</Fragment>);
  const handleShowMore = (): void => setLimit((previous) => previous + 100);

  return (
    <section aria-label="Regex match report" className={styles.report}>
      <h3>Matched source</h3>
      <p>Highlight = full match. ∅ = zero-width match. Offsets are UTF-16 units.</p>
      <pre aria-label="Highlighted source">{report.source ? source : '(empty source)'}</pre>
      {report.matches.length === 0 && <p>No matches.</p>}
      <p>
        {Math.min(limit, report.matches.length)} of {report.matches.length} capture cards
      </p>
      <div className={styles.matches}>
        {report.matches.slice(0, limit).map((match, index) => (
          <article className={styles.match} key={index}>
            <h4>
              Match {index + 1} · {match.index}–{match.end}
            </h4>
            <pre>
              {JSON.stringify(
                { captures: match.captures, groups: match.groups, match: match.match },
                null,
                2,
              )}
            </pre>
          </article>
        ))}
      </div>
      {report.matches.length > limit && (
        <Button size="sm" variant="secondary" onClick={handleShowMore}>
          Show more matches
        </Button>
      )}
      {report.replacementPreview !== undefined && (
        <section aria-label="Replacement preview">
          <h3>Replacement preview</h3>
          <pre>{report.replacementPreview || '(empty replacement result)'}</pre>
        </section>
      )}
    </section>
  );
}

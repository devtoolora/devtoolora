import type { ToolResult } from '@devtoolora/core';
import { Button } from '../../../ui';
import { useEffect, useState, type ReactElement } from 'react';
import styles from './JsonDiffPreview.module.scss';

interface JsonDiffPreviewProps {
  changes: NonNullable<ToolResult['jsonDiff']>['changes'];
}

type DiffEntry = JsonDiffPreviewProps['changes'][number];

function DiffChange({ entry }: { entry: DiffEntry }): ReactElement {
  return (
    <article className={styles.change} data-kind={entry.kind}>
      <h3>
        {entry.kind.toUpperCase()} ·{' '}
        <code>{entry.pointer ? JSON.stringify(entry.pointer) : 'Root (empty pointer)'}</code>
      </h3>
      <div className={styles.values}>
        <div className={styles.before}>
          <h4>Before</h4>
          <pre>{entry.before ?? 'Missing'}</pre>
        </div>
        <div className={styles.after}>
          <h4>After</h4>
          <pre>{entry.after ?? 'Missing'}</pre>
        </div>
      </div>
    </article>
  );
}

export function JsonDiffPreview({ changes }: JsonDiffPreviewProps): ReactElement {
  const [filter, setFilter] = useState('all');
  const [limit, setLimit] = useState(200);
  const visible = changes.filter((entry) => filter === 'all' || entry.kind === filter);

  useEffect(() => {
    setFilter('all');
    setLimit(200);
  }, [changes]);

  return (
    <section aria-label="JSON difference report" className={styles.report}>
      <label className={styles.filter}>
        Show changes
        <select
          value={filter}
          onChange={(event) => {
            setFilter(event.target.value);
            setLimit(200);
          }}
        >
          <option value="all">All</option>
          <option value="added">Added</option>
          <option value="removed">Removed</option>
          <option value="changed">Changed</option>
        </select>
      </label>
      <p>
        {Math.min(limit, visible.length)} of {visible.length} visible changes
      </p>
      {changes.length === 0 && <p>No differences.</p>}
      {changes.length > 0 && visible.length === 0 && <p>No changes of this kind.</p>}
      <div className={styles.changes}>
        {visible.slice(0, limit).map((entry, index) => (
          <DiffChange entry={entry} key={`${entry.pointer}-${index}`} />
        ))}
      </div>
      {visible.length > limit && (
        <Button
          size="sm"
          variant="secondary"
          onClick={() => setLimit((previous) => previous + 200)}
        >
          Show more
        </Button>
      )}
    </section>
  );
}

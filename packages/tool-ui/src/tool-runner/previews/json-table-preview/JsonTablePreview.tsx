import type { ToolResult } from '@devtoolora/core';
import { Button, Input } from '../../../ui';
import { useEffect, useMemo, useState, type ReactElement } from 'react';
import styles from './JsonTablePreview.module.scss';

interface JsonTablePreviewProps {
  table: NonNullable<ToolResult['jsonTable']>;
}

type TableScrollProps = {
  isPlain: boolean;
  rows: Array<{ cells: Array<string | null>; index: number }>;
  table: JsonTablePreviewProps['table'];
};

function TableScroll({ isPlain, rows, table }: TableScrollProps): ReactElement {
  return (
    <div
      aria-label={isPlain ? 'Scrollable data values' : 'Scrollable JSON records'}
      className={styles.scroll}
      role="region"
      tabIndex={0}
    >
      <table>
        <caption>
          {isPlain
            ? 'Data values'
            : 'JSON records · cells show exact JSON text; Missing means absent'}
        </caption>
        <thead>
          <tr>
            {!isPlain && <th scope="col">#</th>}
            {table.columns.map((column) => (
              <th key={column} scope="col">
                {isPlain ? column : JSON.stringify(column)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(({ cells, index }) => (
            <tr key={index}>
              {!isPlain && <th scope="row">{index + 1}</th>}
              {cells.map((cell, column) =>
                isPlain && column === 0 ? (
                  <th key={column} scope="row">
                    {cell ?? 'Missing'}
                  </th>
                ) : (
                  <td data-missing={cell === null} key={column}>
                    {cell ?? 'Missing'}
                  </td>
                ),
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function JsonTablePreview({ table }: JsonTablePreviewProps): ReactElement {
  const isPlain = table.presentation === 'plain';
  const [limit, setLimit] = useState(100);
  const [query, setQuery] = useState('');
  const visible = useMemo(() => {
    const needle = query.toLowerCase();

    return table.rows
      .map((cells, index) => ({ cells, index }))
      .filter(
        (row) =>
          !needle || row.cells.some((cell) => (cell ?? 'Missing').toLowerCase().includes(needle)),
      );
  }, [query, table]);

  useEffect(() => {
    setQuery('');
    setLimit(100);
  }, [table]);

  function handleSearch(value: string): void {
    setQuery(value);
    setLimit(100);
  }

  return (
    <section
      aria-label={isPlain ? 'Data table' : 'Interactive JSON table'}
      className={styles.viewer}
      data-presentation={table.presentation ?? 'json'}
    >
      {!isPlain && (
        <label className={styles.search}>
          Search row values
          <Input type="search" value={query} onChange={handleSearch} />
        </label>
      )}

      {!isPlain && (
        <p aria-live="polite">
          {Math.min(limit, visible.length)} of {visible.length} matching rows · {table.rows.length}{' '}
          total · export includes all records
        </p>
      )}

      {table.rows.length === 0 && <p>No records. The input array is empty.</p>}
      {table.rows.length > 0 && table.columns.length === 0 && (
        <p>These objects have no data keys.</p>
      )}
      {table.rows.length > 0 && visible.length === 0 && <p>No matching rows.</p>}

      <TableScroll isPlain={isPlain} rows={visible.slice(0, limit)} table={table} />

      {visible.length > limit && (
        <Button
          size="sm"
          variant="secondary"
          onClick={() => setLimit((previous) => previous + 100)}
        >
          Show more
        </Button>
      )}
    </section>
  );
}

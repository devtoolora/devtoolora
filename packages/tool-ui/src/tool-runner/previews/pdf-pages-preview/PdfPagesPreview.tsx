import type { SerializedToolDefinition } from '@devtoolora/core';
import { useMemo, type ReactElement } from 'react';
import type { ToolPlatformActions } from '../../types';
import { MergeList } from './MergeList';
import { PageGrid } from './PageGrid';
import { StampPreview } from './StampPreview';
import { pdfSources, sourceKeys } from './pdfPages';

type PdfPagesPreviewProps = {
  fields: Record<string, string>;
  platformActions?: ToolPlatformActions;
  resultPdf?: string;
  tool: SerializedToolDefinition;
  onFieldChange(fieldId: string, value: string): void;
};

export function PdfPagesPreview({
  fields,
  platformActions,
  resultPdf,
  tool,
  onFieldChange,
}: PdfPagesPreviewProps): ReactElement | null {
  const sources = useMemo(
    () => pdfSources(fields.pdfs ?? '', fields.pdfsName ?? ''),
    [fields.pdfs, fields.pdfsName],
  );
  const [first] = sources;

  if (tool.preview === 'pdf-stamp') {
    return first ? (
      <StampPreview key={sourceKeys([first])[0]} resultPdf={resultPdf} source={first} />
    ) : null;
  }

  const mode = fields.mode || 'merge';

  if (mode === 'merge') {
    const field = tool.fields?.find((item) => item.id === 'pdfs');

    return sources.length ? (
      <MergeList
        field={field?.type === 'file' ? { ...field, type: 'file' } : undefined}
        platformActions={platformActions}
        sources={sources}
        onFieldChange={onFieldChange}
      />
    ) : null;
  }

  if (!first) return null;

  return (
    <PageGrid
      fields={fields}
      fileCount={sources.length}
      key={sourceKeys([first])[0]}
      mode={mode}
      source={first}
      onFieldChange={onFieldChange}
    />
  );
}

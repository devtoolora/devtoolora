import type { SerializedToolDefinition, ToolResult, ToolSample } from '@devtoolora/core';
import { lazy, Suspense, type ReactElement } from 'react';
import { ColorPalettePreview } from '../color-palette-preview';
import { CssAnimationPreview } from '../css-animation-preview';
import { CssClipEditor } from '../../editors';
import { CssEasingPreview } from '../css-easing-preview';
import { CssLivePreview, isCssLivePreview } from '../css-live-preview';
import { CssLoaderPreview } from '../css-loader-preview';
import { SvgPathPreview } from '../svg-path-preview';
import type { ToolPlatformActions } from '../../types';

const PdfPagesPreview = lazy(() =>
  import('../pdf-pages-preview').then((module) => ({ default: module.PdfPagesPreview })),
);

type ToolVisualPreviewProps = {
  fields: Record<string, string>;
  platformActions?: ToolPlatformActions;
  result?: ToolResult;
  text: string;
  tool: SerializedToolDefinition;
  onFieldChange(id: string, value: string): void;
  onSampleApply(sample: ToolSample): void;
};

export function ToolVisualPreview({
  fields,
  platformActions,
  result,
  text,
  tool,
  onFieldChange,
  onSampleApply,
}: ToolVisualPreviewProps): ReactElement | null {
  if (tool.preview === 'pdf-pages' || tool.preview === 'pdf-stamp') {
    return (
      <Suspense fallback={null}>
        <PdfPagesPreview
          fields={fields}
          platformActions={platformActions}
          resultPdf={
            result?.artifact?.mimeType === 'application/pdf' ? result.artifact.base64 : undefined
          }
          tool={tool}
          onFieldChange={onFieldChange}
        />
      </Suspense>
    );
  }

  if (tool.preview === 'color-palette') {
    return (
      <ColorPalettePreview
        platformActions={platformActions}
        scheme={fields.scheme ?? 'complementary'}
        text={text}
        valid={Boolean(result)}
      />
    );
  }

  if (tool.preview === 'css-animation') return <CssAnimationPreview css={result?.text} />;

  if (tool.preview === 'css-loader') return <CssLoaderPreview css={result?.text} />;

  if (tool.preview === 'css-easing')
    return <CssEasingPreview css={result?.text} fields={fields} onFieldChange={onFieldChange} />;

  if (tool.preview === 'css-clip-path') {
    return (
      <CssClipEditor
        fields={fields}
        samples={tool.samples ?? []}
        onFieldChange={onFieldChange}
        onSampleApply={onSampleApply}
      />
    );
  }

  if (tool.preview === 'svg-path')
    return result?.svgPath ? <SvgPathPreview path={result.svgPath} /> : null;

  if (tool.preview && isCssLivePreview(tool.preview))
    return <CssLivePreview css={result?.text} fields={fields} kind={tool.preview} />;

  return null;
}

import type { ToolSample } from '@devtoolora/core';
import { MAX_POLYGON_POINTS } from '@devtoolora/functions/css';
import { type ReactElement } from 'react';
import { ClipShapePresets, PolygonActions } from './CssClipEditorParts';
import { editingHint } from './clipGeometry';
import { type PolygonEditing } from './usePolygonEditing';

type ClipEditorControlsProps = {
  editing: PolygonEditing;
  isPolygon: boolean;
  pointCount: number;
  samples: ToolSample[];
  shape: string;
  value?: string;
};

export function ClipEditorControls({
  editing,
  isPolygon,
  pointCount,
  samples,
  shape,
  value,
}: ClipEditorControlsProps): ReactElement {
  return (
    <>
      <header>
        <strong>Live clip-path editor</strong>
        <span>{isPolygon ? `${pointCount} / ${MAX_POLYGON_POINTS} points` : value}</span>
      </header>
      <ClipShapePresets samples={samples} onSampleApply={editing.handleSampleApply} />
      <p>{editingHint(shape)}</p>
      {isPolygon && (
        <PolygonActions
          adding={editing.adding}
          pointCount={pointCount}
          pointLimit={MAX_POLYGON_POINTS}
          onAddingToggle={editing.handleAddingToggle}
          onSelectedRemove={editing.handleSelectedRemove}
        />
      )}
    </>
  );
}

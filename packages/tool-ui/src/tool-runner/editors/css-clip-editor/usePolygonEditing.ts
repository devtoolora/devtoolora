import type { ToolSample } from '@devtoolora/core';
import { type PolygonPoint } from '@devtoolora/functions/css';
import { useState } from 'react';
import { type CssClipEditorProps } from './types';

export type PolygonEditing = {
  active: number;
  adding: boolean;
  handleAddingToggle(): void;
  handleCenterChange(point: PolygonPoint): void;
  handlePointAdd(point: PolygonPoint): void;
  handlePointChange(index: number, point: PolygonPoint): void;
  handlePointsChange(points: PolygonPoint[]): void;
  handlePointSelect(index: number): void;
  handleSampleApply(sample: ToolSample): void;
  handleSelectedRemove(): void;
};

export function usePolygonEditing(
  points: PolygonPoint[],
  onFieldChange: CssClipEditorProps['onFieldChange'],
  onSampleApply: CssClipEditorProps['onSampleApply'],
): PolygonEditing {
  const [selected, setSelected] = useState(0);
  const [adding, setAdding] = useState(false);
  const active = Math.min(selected, Math.max(0, points.length - 1));

  const handlePointsChange = (next: PolygonPoint[]): void =>
    onFieldChange('points', JSON.stringify(next));

  return {
    active,
    adding,
    handleAddingToggle: () => setAdding(!adding),
    handleCenterChange: ([x, y]) => {
      onFieldChange('centerX', String(x));
      onFieldChange('centerY', String(y));
    },
    handlePointAdd: (point) => {
      handlePointsChange([...points, point]);
      setSelected(points.length);
      setAdding(false);
    },
    handlePointChange: (index, point) =>
      handlePointsChange(points.map((current, position) => (position === index ? point : current))),
    handlePointsChange,
    handlePointSelect: (index) => setSelected(index),
    handleSampleApply: (sample) => {
      setSelected(0);
      setAdding(false);
      onSampleApply(sample);
    },
    handleSelectedRemove: () => {
      handlePointsChange(points.filter((_, index) => index !== active));
      setSelected(Math.max(0, active - 1));
    },
  };
}

import { isToolFieldHidden, type SerializedToolDefinition } from '@devtoolora/core';
import type { ReactElement } from 'react';
import { ColorFieldControl } from '../../components/tool-field-control/ColorFieldControl';
import { CssGradientStopsControls } from './CssGradientStopsControls';
import { RangeFieldControl } from '../../components/tool-field-control/RangeFieldControl';
import { CssShadowControls } from './CssShadowControls';
import { ToolFieldControl } from '../../components';
import styles from './CssDesignControls.module.scss';
import { easingPresets } from '@devtoolora/functions/css';

type CssDesignControlsProps = {
  fields: Record<string, string>;
  tool: SerializedToolDefinition;
  onFieldChange(id: string, value: string): void;
};
const limits: Record<string, [number, number, string, number]> = {
  basis: [0, 800, 'px', 1],
  columnGap: [0, 96, 'px', 1],
  columns: [1, 12, '', 1],
  gap: [0, 96, 'px', 1],
  grow: [0, 12, '', 0.1],
  minTrack: [40, 600, 'px', 1],
  order: [-12, 12, '', 1],
  rowGap: [0, 96, 'px', 1],
  rows: [1, 8, '', 1],
  shrink: [0, 12, '', 0.1],
  bottomLeft: [0, 200, 'px', 1],
  bottomRight: [0, 200, 'px', 1],
  size: [1, 200, 'px', 1],
  topLeft: [0, 200, 'px', 1],
  topRight: [0, 200, 'px', 1],
  delay: [0, 10000, 'ms', 1],
  distance: [-200, 200, 'px', 1],
  duration: [100, 10000, 'ms', 1],
  opacity: [0, 100, '%', 1],
  scale: [1, 200, '%', 1],
  centerX: [0, 100, '%', 1],
  centerY: [0, 100, '%', 1],
  insetBottom: [0, 100, '%', 1],
  insetLeft: [0, 100, '%', 1],
  insetRight: [0, 100, '%', 1],
  insetRound: [0, 200, 'px', 1],
  insetTop: [0, 100, '%', 1],
  radius: [0, 100, '%', 1],
  radiusX: [0, 100, '%', 1],
  radiusY: [0, 100, '%', 1],
};

const radiusCorners = ['topLeft', 'topRight', 'bottomRight', 'bottomLeft'];
const easingPointIds = ['x1', 'y1', 'x2', 'y2'];

function syncEasingFields(
  id: string,
  value: string,
  onFieldChange: CssDesignControlsProps['onFieldChange'],
): void {
  const preset = Object.hasOwn(easingPresets, value) ? easingPresets[value] : undefined;

  if (id === 'preset' && preset)
    easingPointIds.forEach((pointId, index) => onFieldChange(pointId, String(preset[index])));
  if (easingPointIds.includes(id)) onFieldChange('preset', 'custom');
}

type ToolField = NonNullable<SerializedToolDefinition['fields']>[number];

type DesignFieldProps = {
  field: ToolField;
  value: string;
  onFieldChange(id: string, value: string): void;
  onValueChange(next: string): void;
};

function PointsJsonField({ value, onFieldChange }: DesignFieldProps): ReactElement {
  return (
    <details className={styles.advanced}>
      <summary>Points JSON (advanced)</summary>
      <label>
        <span>Points JSON</span>
        <textarea
          rows={6}
          spellCheck={false}
          value={value}
          onChange={(event) => onFieldChange('points', event.target.value)}
        />
      </label>
    </details>
  );
}

type DesignControlProps = DesignFieldProps & { previewKind?: string };

function DesignControl({ previewKind, ...props }: DesignControlProps): ReactElement {
  const { field, value, onValueChange } = props;
  const limit = limits[field.id];
  const range: [number, number, string, number] | undefined =
    field.type === 'number' && field.range
      ? [field.range.min, field.range.max, field.range.unit ?? '', field.range.step ?? 1]
      : limit;

  if (field.id === 'points') return <PointsJsonField {...props} />;
  if (previewKind === 'css-gradient' && field.id === 'stops')
    return <CssGradientStopsControls value={value} onValueChange={onValueChange} />;

  if (field.type === 'number' && range)
    return (
      <RangeFieldControl
        label={field.label}
        maximum={range[1]}
        minimum={range[0]}
        step={range[3]}
        unit={range[2]}
        value={value}
        onValueChange={onValueChange}
      />
    );

  if (
    (field.type === 'text' && field.presentation === 'color') ||
    (previewKind === 'css-triangle' && field.id === 'color')
  )
    return <ColorFieldControl field={field} value={value} onValueChange={onValueChange} />;

  return <ToolFieldControl field={field} value={value} onValueChange={onValueChange} />;
}

export function CssDesignControls({
  fields,
  tool,
  onFieldChange,
}: CssDesignControlsProps): ReactElement {
  if (tool.preview === 'css-shadow' || tool.preview === 'css-text-shadow')
    return (
      <CssShadowControls
        value={fields.layers ?? tool.fields?.[0]?.defaultValue ?? ''}
        variant={tool.preview === 'css-text-shadow' ? 'text' : 'box'}
        onValueChange={(value) => onFieldChange('layers', value)}
      />
    );

  const handleChange = (id: string, value: string): void => {
    onFieldChange(id, value);
    if (tool.preview === 'css-radius' && id !== 'linked' && fields.linked !== 'false')
      for (const corner of radiusCorners) if (corner !== id) onFieldChange(corner, value);
    if (id === 'linked' && value === 'true')
      for (const corner of radiusCorners) onFieldChange(corner, fields.topLeft ?? '16');
    if (tool.preview === 'css-easing') syncEasingFields(id, value, onFieldChange);
  };

  return (
    <div className={styles.controls}>
      {tool.fields?.map((field) =>
        isToolFieldHidden(tool, field.id, fields) ? null : (
          <DesignControl
            field={field}
            key={field.id}
            previewKind={tool.preview}
            value={fields[field.id] ?? field.defaultValue ?? ''}
            onFieldChange={onFieldChange}
            onValueChange={(next) => handleChange(field.id, next)}
          />
        ),
      )}
    </div>
  );
}

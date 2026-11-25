import {
  parseShadowLayers,
  parseTextShadowLayers,
  shadowColor,
  shadowColorWithOpacity,
  type ShadowLayer,
  type TextShadowLayer,
} from '@devtoolora/functions/css';
import type { ReactElement } from 'react';
import { Button } from '../../../ui';
import { RangeFieldControl } from '../../components/tool-field-control/RangeFieldControl';
import styles from './CssDesignControls.module.scss';

type AnyShadowLayer = ShadowLayer | TextShadowLayer;
type ShadowVariant = 'box' | 'text';

const maxLayers = 5;
const newLayers: Record<ShadowVariant, AnyShadowLayer> = {
  box: { blur: 40, color: 'rgba(15, 23, 42, 0.18)', inset: false, spread: -8, x: 0, y: 18 },
  text: { blur: 8, color: 'rgba(15, 23, 42, 0.25)', x: 0, y: 4 },
};

type ShadowLayerFieldsetProps = {
  index: number;
  layer: AnyShadowLayer;
  layerCount: number;
  variant: ShadowVariant;
  onLayerChange(change: Partial<ShadowLayer>): void;
  onMove(direction: number): void;
  onRemove(): void;
};

const boxKeys = ['x', 'y', 'blur', 'spread'] as const;
const textKeys = ['x', 'y', 'blur'] as const;

const offsetLabels = { blur: 'Blur', spread: 'Spread', x: 'Horizontal', y: 'Vertical' } as const;

type ShadowColorControlsProps = {
  color: ReturnType<typeof shadowColor>;
  index: number;
  onColorChange(color: string): void;
};

function ShadowColorControls({
  color,
  index,
  onColorChange,
}: ShadowColorControlsProps): ReactElement {
  return (
    <>
      <label className={styles.colorControl}>
        <span>Color</span>
        <input
          aria-label={`Layer ${index + 1} color`}
          type="color"
          value={color.hex}
          onChange={(event) =>
            onColorChange(shadowColorWithOpacity(event.target.value, color.opacity))
          }
        />
      </label>
      <RangeFieldControl
        label="Opacity"
        maximum={100}
        minimum={0}
        presentation="slider"
        unit="%"
        value={String(Math.round(color.opacity * 10000) / 100)}
        onValueChange={(raw) => onColorChange(shadowColorWithOpacity(color.hex, Number(raw) / 100))}
      />
    </>
  );
}

type ShadowLayerActionsProps = Pick<
  ShadowLayerFieldsetProps,
  'index' | 'layerCount' | 'onMove' | 'onRemove'
>;

function ShadowLayerActions({
  index,
  layerCount,
  onMove,
  onRemove,
}: ShadowLayerActionsProps): ReactElement {
  return (
    <div className={styles.layerActions}>
      <Button
        aria-label={`Move up layer ${index + 1}`}
        disabled={index === 0}
        size="sm"
        variant="ghost"
        onClick={() => onMove(-1)}
      >
        Move up
      </Button>
      <Button
        aria-label={`Move down layer ${index + 1}`}
        disabled={index === layerCount - 1}
        size="sm"
        variant="ghost"
        onClick={() => onMove(1)}
      >
        Move down
      </Button>
      <Button
        aria-label={`Remove layer ${index + 1}`}
        disabled={layerCount === 1}
        size="sm"
        variant="ghost"
        onClick={onRemove}
      >
        Remove
      </Button>
    </div>
  );
}

function ShadowLayerFieldset({
  index,
  layer,
  layerCount,
  variant,
  onLayerChange,
  onMove,
  onRemove,
}: ShadowLayerFieldsetProps): ReactElement {
  const color = shadowColor(layer.color);
  const limit = limits[variant];

  return (
    <fieldset className={styles.layer}>
      <legend>Layer {index + 1}</legend>
      {(variant === 'text' ? textKeys : boxKeys).map((key) => (
        <RangeFieldControl
          key={key}
          label={offsetLabels[key]}
          maximum={key === 'blur' ? limit.blur : limit.offset}
          minimum={key === 'blur' ? 0 : -limit.offset}
          presentation="slider"
          unit="px"
          value={String(layerValue(layer, key))}
          onValueChange={(raw) => onLayerChange({ [key]: Number(raw) })}
        />
      ))}
      <ShadowColorControls
        color={color}
        index={index}
        onColorChange={(next) => onLayerChange({ color: next })}
      />
      {'inset' in layer && (
        <label className={styles.insetControl}>
          <input
            checked={layer.inset}
            type="checkbox"
            onChange={(event) => onLayerChange({ inset: event.target.checked })}
          />
          <span>Inset</span>
        </label>
      )}
      <ShadowLayerActions
        index={index}
        layerCount={layerCount}
        onMove={onMove}
        onRemove={onRemove}
      />
    </fieldset>
  );
}

function layerValue(layer: AnyShadowLayer, key: 'blur' | 'spread' | 'x' | 'y'): number {
  if (key !== 'spread') return layer[key];

  return 'spread' in layer ? layer.spread : 0;
}

const limits = {
  box: { blur: 300, offset: 200 },
  text: { blur: 100, offset: 100 },
} as const;

function LayerJsonField({ value, onValueChange }: CssShadowControlsProps): ReactElement {
  return (
    <details className={styles.advanced}>
      <summary>Layer JSON (advanced)</summary>
      <label>
        <span>Layer JSON</span>
        <textarea
          rows={5}
          spellCheck={false}
          value={value}
          onChange={(event) => onValueChange(event.target.value)}
        />
      </label>
    </details>
  );
}

type CssShadowControlsProps = {
  value: string;
  variant?: ShadowVariant;
  onValueChange(value: string): void;
};

export function CssShadowControls({
  value,
  variant = 'box',
  onValueChange,
}: CssShadowControlsProps): ReactElement {
  let layers: AnyShadowLayer[] = [];
  let error = '';

  try {
    layers = (variant === 'text' ? parseTextShadowLayers : parseShadowLayers)(value);
  } catch (failure) {
    error = failure instanceof Error ? failure.message : 'Invalid shadow layers.';
  }

  const handleLayersChange = (next: AnyShadowLayer[]): void => onValueChange(JSON.stringify(next));
  const handleLayerChange = (index: number, change: Partial<ShadowLayer>): void =>
    handleLayersChange(
      layers.map((layer, current) => (current === index ? { ...layer, ...change } : layer)),
    );

  const handleMove = (index: number, direction: number): void => {
    const next = [...layers];
    const layer = next[index];
    const swapped = next[index + direction];

    if (!layer || !swapped) return;

    [next[index], next[index + direction]] = [swapped, layer];
    handleLayersChange(next);
  };

  return (
    <div className={styles.shadowControls}>
      <div className={styles.layerHeading}>
        <strong>{layers.length} shadow layers</strong>
        <Button
          disabled={layers.length >= maxLayers}
          size="sm"
          title={layers.length >= maxLayers ? `Maximum ${maxLayers} layers` : undefined}
          variant="secondary"
          onClick={() => handleLayersChange([...layers, newLayers[variant]])}
        >
          Add layer
        </Button>
      </div>

      {error && (
        <p className={styles.error}>{error} Use Clear to reset, or repair Layer JSON below.</p>
      )}

      {layers.map((layer, index) => (
        <ShadowLayerFieldset
          index={index}
          key={index}
          layer={layer}
          layerCount={layers.length}
          variant={variant}
          onLayerChange={(change) => handleLayerChange(index, change)}
          onMove={(direction) => handleMove(index, direction)}
          onRemove={() => handleLayersChange(layers.filter((_, current) => current !== index))}
        />
      ))}

      <LayerJsonField value={value} onValueChange={onValueChange} />
    </div>
  );
}

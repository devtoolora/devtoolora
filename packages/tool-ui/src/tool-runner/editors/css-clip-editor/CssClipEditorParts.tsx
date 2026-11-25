import type { ToolSample } from '@devtoolora/core';
import { clipPathValue, clipShapeFromFields, type PolygonPoint } from '@devtoolora/functions/css';
import type {
  CSSProperties,
  KeyboardEvent,
  PointerEvent,
  ReactElement,
  ReactNode,
  RefObject,
} from 'react';
import { Button } from '../../../ui';
import { takePickedFiles } from '../../utils/takePickedFiles';
import styles from './CssClipEditor.module.scss';

export type Surface = 'checkerboard' | 'gradient' | 'grid' | 'stripes';

const surfaces: Array<[Surface, string]> = [
  ['gradient', 'Gradient'],
  ['checkerboard', 'Checkerboard'],
  ['stripes', 'Stripes'],
  ['grid', 'Grid'],
];
const moves: Record<string, PolygonPoint> = {
  ArrowDown: [0, 1],
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, -1],
};

export const coordinate = (number: number): number =>
  Math.round(Math.max(0, Math.min(100, number)) * 100) / 100;

export function shapeValue(fields: Record<string, string> | undefined): string | undefined {
  try {
    return clipPathValue(clipShapeFromFields(fields ?? {}));
  } catch {
    return undefined;
  }
}

function handleArrowKey(
  event: KeyboardEvent<HTMLButtonElement>,
  [x, y]: PolygonPoint,
  onMove: (point: PolygonPoint) => void,
): void {
  const move = Object.hasOwn(moves, event.key) ? moves[event.key] : undefined;

  if (!move) return;

  event.preventDefault();
  const step = event.shiftKey ? 10 : 1;

  onMove([coordinate(x + move[0] * step), coordinate(y + move[1] * step)]);
}

type ClipShapePresetsProps = {
  samples: ToolSample[];
  onSampleApply(sample: ToolSample): void;
};

export function ClipShapePresets({ samples, onSampleApply }: ClipShapePresetsProps): ReactElement {
  return (
    <div aria-label="Shape presets" className={styles.presets} role="group">
      {samples.map((sample) => (
        <button
          aria-label={sample.label}
          className={styles.preset}
          key={sample.label}
          title={sample.label}
          type="button"
          onClick={() => onSampleApply(sample)}
        >
          <span style={{ clipPath: shapeValue(sample.fields) }} />
        </button>
      ))}
    </div>
  );
}

type PolygonActionsProps = {
  adding: boolean;
  pointCount: number;
  pointLimit: number;
  onAddingToggle(): void;
  onSelectedRemove(): void;
};

export function PolygonActions({
  adding,
  pointCount,
  pointLimit,
  onAddingToggle,
  onSelectedRemove,
}: PolygonActionsProps): ReactElement {
  return (
    <div className={styles.actions}>
      <Button
        aria-pressed={adding}
        disabled={pointCount < 3 || pointCount >= pointLimit}
        size="sm"
        variant={adding ? 'primary' : 'secondary'}
        onClick={onAddingToggle}
      >
        Click canvas to add
      </Button>
      <Button disabled={pointCount <= 3} size="sm" variant="secondary" onClick={onSelectedRemove}>
        Remove selected point
      </Button>
    </div>
  );
}

type ClipLayersProps = {
  image: string;
  isMovable: boolean;
  showOutside: boolean;
  surface: Surface;
  value?: string;
  onMove(event: PointerEvent<HTMLDivElement>): void;
  onMoveEnd(): void;
  onMoveStart(event: PointerEvent<HTMLDivElement>): void;
};

export function ClipLayers({
  image,
  isMovable,
  showOutside,
  surface,
  value,
  onMove,
  onMoveEnd,
  onMoveStart,
}: ClipLayersProps): ReactElement {
  const layerClass = image ? styles.photo : styles[surface];
  const layerStyle: CSSProperties | undefined = image
    ? { backgroundImage: `url("${image}")` }
    : undefined;

  return (
    <>
      {value && showOutside && (
        <div
          aria-hidden="true"
          className={`${styles.layer} ${styles.outside} ${layerClass}`}
          data-css-preview="outside"
          style={layerStyle}
        />
      )}
      {value && (
        <div
          className={`${styles.layer} ${layerClass} ${isMovable ? styles.movable : ''}`}
          data-css-preview="clip-path"
          style={{ ...layerStyle, clipPath: value }}
          onLostPointerCapture={onMoveEnd}
          onPointerCancel={onMoveEnd}
          onPointerDown={onMoveStart}
          onPointerMove={onMove}
          onPointerUp={onMoveEnd}
        />
      )}
    </>
  );
}

type ClipHandleProps = {
  children: ReactNode;
  label: string;
  point: PolygonPoint;
  pressed?: boolean;
  onDragEnd(): void;
  onDragMove(event: PointerEvent<HTMLButtonElement>): void;
  onDragStart(): void;
  onFocus?(): void;
  onMove(point: PolygonPoint): void;
};

export function ClipHandle({
  children,
  label,
  point,
  pressed,
  onDragEnd,
  onDragMove,
  onDragStart,
  onFocus,
  onMove,
}: ClipHandleProps): ReactElement {
  const [x, y] = point;

  return (
    <button
      aria-label={label}
      aria-pressed={pressed}
      className={styles.handle}
      style={{ left: `${x}%`, top: `${y}%` }}
      title={`${x}% ${y}%`}
      type="button"
      onFocus={onFocus}
      onKeyDown={(event) => handleArrowKey(event, point, onMove)}
      onLostPointerCapture={onDragEnd}
      onPointerCancel={onDragEnd}
      onPointerDown={(event) => {
        onDragStart();
        event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerMove={onDragMove}
      onPointerUp={onDragEnd}
    >
      {children}
    </button>
  );
}

type ClipPreviewOptionsProps = {
  image: string;
  imageError: string;
  imageInputRef: RefObject<HTMLInputElement | null>;
  showOutside: boolean;
  surface: Surface;
  onImageChange(file: File | undefined): void;
  onImageRemove(): void;
  onShowOutsideChange(showOutside: boolean): void;
  onSurfaceChange(surface: Surface): void;
};

export function ClipPreviewOptions({
  image,
  imageError,
  imageInputRef,
  showOutside,
  surface,
  onImageChange,
  onImageRemove,
  onShowOutsideChange,
  onSurfaceChange,
}: ClipPreviewOptionsProps): ReactElement {
  return (
    <>
      <div className={styles.options}>
        <label>
          <input
            checked={showOutside}
            type="checkbox"
            onChange={(event) => onShowOutsideChange(event.target.checked)}
          />
          Show outside clip-path
        </label>
        <label>
          <span>Preview surface</span>
          <select
            disabled={Boolean(image)}
            value={surface}
            onChange={(event) => onSurfaceChange(event.target.value as Surface)}
          >
            {surfaces.map(([id, label]) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className={styles.imagePicker}>
        <span>Preview image (local only)</span>
        <input
          accept="image/png,image/jpeg,image/webp"
          ref={imageInputRef}
          type="file"
          onChange={(event) => onImageChange(takePickedFiles(event)[0])}
        />
      </label>
      {image && (
        <Button size="sm" variant="ghost" onClick={onImageRemove}>
          Remove preview image
        </Button>
      )}
      {imageError && <p role="alert">{imageError}</p>}
      <p>
        The preview surface, image and Show outside are not exported. This creates CSS clipping, not
        a pixel crop.
      </p>
    </>
  );
}

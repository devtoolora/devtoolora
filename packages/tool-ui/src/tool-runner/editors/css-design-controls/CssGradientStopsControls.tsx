import { parseGradientStops, type GradientStop } from '@devtoolora/functions/css';
import {
  useRef,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
  type ReactElement,
} from 'react';
import { Button } from '../../../ui';
import { ColorInputControl } from '../../components/tool-field-control/ColorFieldControl';
import { RangeFieldControl } from '../../components/tool-field-control/RangeFieldControl';
import {
  clampPosition,
  insertedStops,
  pickedColor,
  pickerHex,
  readStops,
} from './gradientStopMath';
import styles from './CssDesignControls.module.scss';

const MAX_STOPS = 8;
const MIN_STOPS = 2;

type CssGradientStopsControlsProps = {
  value: string;
  onValueChange(value: string): void;
};

const arrowSteps: Record<string, number> = {
  ArrowDown: -1,
  ArrowLeft: -1,
  ArrowRight: 1,
  ArrowUp: 1,
};

function keyedPosition(
  event: KeyboardEvent<HTMLSpanElement>,
  position: number,
): number | undefined {
  const step = arrowSteps[event.key];

  if (step !== undefined) return clampPosition(position + step * (event.shiftKey ? 10 : 1));
  if (event.key === 'Home') return 0;
  if (event.key === 'End') return 100;

  return undefined;
}

type StopStripProps = {
  stops: GradientStop[];
  valid: boolean;
  onPositionChange(index: number, position: number): void;
};

type MarkerDrag = { coincident: number[]; index?: number; position: number };

/**
 * Coincident markers stack, so the drag direction picks which one moves: right takes the last of
 * them, left the first, which keeps their order in the gradient.
 */
function draggedIndex(drag: MarkerDrag, position: number): number | undefined {
  if (drag.index !== undefined || position === drag.position) return drag.index;

  return position > drag.position ? drag.coincident.at(-1) : drag.coincident[0];
}

type StopMarkerProps = {
  index: number;
  stop: GradientStop;
  onDragEnd(): void;
  onKeyDown(event: KeyboardEvent<HTMLSpanElement>): void;
  onPointerDown(event: PointerEvent<HTMLSpanElement>): void;
  onPointerMove(event: PointerEvent<HTMLSpanElement>): void;
};

function StopMarker({
  index,
  stop,
  onDragEnd,
  onKeyDown,
  onPointerDown,
  onPointerMove,
}: StopMarkerProps): ReactElement {
  const swatch = pickerHex(stop.color);
  const style = {
    '--stop-color': pickedColor(swatch.hex, swatch.alpha),
    left: `${stop.position}%`,
  } as CSSProperties;

  return (
    <span
      aria-label={`Stop ${index + 1} marker`}
      aria-valuemax={100}
      aria-valuemin={0}
      aria-valuenow={stop.position}
      aria-valuetext={`${stop.position}%`}
      className={styles.stopMarker}
      role="slider"
      style={style}
      tabIndex={0}
      title={`Stop ${index + 1}: ${stop.position}%`}
      onKeyDown={onKeyDown}
      onLostPointerCapture={onDragEnd}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
    />
  );
}

function StopStrip({ stops, valid, onPositionChange }: StopStripProps): ReactElement {
  const track = useRef<HTMLDivElement>(null);
  const dragging = useRef<MarkerDrag | undefined>(undefined);
  const fill = [...stops]
    .sort((left, right) => left.position - right.position)
    .map((stop) => `${stop.color} ${stop.position}%`)
    .join(', ');

  const handlePointerDown = (event: PointerEvent<HTMLSpanElement>, index: number): void => {
    if (event.button !== 0) return;

    const position = stops[index]?.position ?? 0;
    const coincident = stops.flatMap((stop, current) =>
      stop.position === position ? [current] : [],
    );

    dragging.current = { coincident, index: coincident.length > 1 ? undefined : index, position };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: PointerEvent<HTMLSpanElement>): void => {
    const bounds = track.current?.getBoundingClientRect();
    const drag = dragging.current;

    if (!drag || !bounds?.width) return;

    const position = Math.round(
      clampPosition(((event.clientX - bounds.left) / bounds.width) * 100),
    );

    drag.index = draggedIndex(drag, position);
    if (drag.index !== undefined) onPositionChange(drag.index, position);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLSpanElement>, index: number): void => {
    const next = keyedPosition(event, stops[index]?.position ?? 0);

    if (next === undefined) return;

    event.preventDefault();
    onPositionChange(index, next);
  };

  return (
    <div className={styles.stopStrip}>
      <div className={styles.stopTrack} ref={track}>
        {valid && (
          <span
            aria-hidden="true"
            className={styles.stopFill}
            style={{ backgroundImage: `linear-gradient(90deg, ${fill})` }}
          />
        )}
        {stops.map((stop, index) => (
          <StopMarker
            index={index}
            key={index}
            stop={stop}
            onDragEnd={() => {
              dragging.current = undefined;
            }}
            onKeyDown={(event) => handleKeyDown(event, index)}
            onPointerDown={(event) => handlePointerDown(event, index)}
            onPointerMove={handlePointerMove}
          />
        ))}
      </div>
    </div>
  );
}

type StopRowProps = {
  index: number;
  stop: GradientStop;
  stopCount: number;
  onRemove(): void;
  onStopChange(change: Partial<GradientStop>): void;
};

function StopRow({ index, stop, stopCount, onRemove, onStopChange }: StopRowProps): ReactElement {
  const label = `Stop ${index + 1}`;
  const picker = pickerHex(stop.color);

  return (
    <fieldset className={styles.layer}>
      <legend>
        {label} · {stop.position}%
      </legend>
      <ColorInputControl
        label={`${label} color`}
        pickerValue={picker.hex}
        value={stop.color}
        onPick={(hex) => onStopChange({ color: pickedColor(hex, picker.alpha) })}
        onValueChange={(color) => onStopChange({ color })}
      />
      <RangeFieldControl
        label={`${label} position`}
        maximum={100}
        minimum={0}
        presentation="slider"
        unit="%"
        value={String(stop.position)}
        onValueChange={(raw) => onStopChange({ position: clampPosition(Number(raw)) })}
      />
      <div className={styles.layerActions}>
        <Button
          aria-label={`Remove stop ${index + 1}`}
          disabled={stopCount <= MIN_STOPS}
          size="sm"
          title={stopCount <= MIN_STOPS ? `Minimum ${MIN_STOPS} stops` : undefined}
          variant="ghost"
          onClick={onRemove}
        >
          Remove
        </Button>
      </div>
    </fieldset>
  );
}

function StopsJsonField({ value, onValueChange }: CssGradientStopsControlsProps): ReactElement {
  return (
    <details className={styles.advanced}>
      <summary>Stops JSON (advanced)</summary>
      <label>
        <span>Stops JSON</span>
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

export function CssGradientStopsControls({
  value,
  onValueChange,
}: CssGradientStopsControlsProps): ReactElement {
  const stops = readStops(value) ?? [];
  let error = '';

  try {
    parseGradientStops(value);
  } catch (failure) {
    error = failure instanceof Error ? failure.message : 'Invalid gradient stops.';
  }

  const handleStopsChange = (next: GradientStop[]): void => onValueChange(JSON.stringify(next));
  const handleStopChange = (index: number, change: Partial<GradientStop>): void =>
    handleStopsChange(
      stops.map((stop, current) => (current === index ? { ...stop, ...change } : stop)),
    );
  const isFull = stops.length >= MAX_STOPS;

  return (
    <div className={styles.shadowControls}>
      <div className={styles.layerHeading}>
        <strong>
          {stops.length} of {MAX_STOPS} color stops
        </strong>
        <Button
          disabled={isFull || stops.length < MIN_STOPS}
          size="sm"
          title={isFull ? `Maximum ${MAX_STOPS} stops` : undefined}
          variant="secondary"
          onClick={() => handleStopsChange(insertedStops(stops))}
        >
          Add stop
        </Button>
      </div>

      {stops.length > 0 && (
        <StopStrip
          stops={stops}
          valid={!error}
          onPositionChange={(index, position) => handleStopChange(index, { position })}
        />
      )}

      {error && <p className={styles.error}>{error} Fix the stop below, or repair Stops JSON.</p>}

      {stops.map((stop, index) => (
        <StopRow
          index={index}
          key={index}
          stop={stop}
          stopCount={stops.length}
          onRemove={() => handleStopsChange(stops.filter((_, current) => current !== index))}
          onStopChange={(change) => handleStopChange(index, change)}
        />
      ))}

      <StopsJsonField value={value} onValueChange={onValueChange} />
    </div>
  );
}

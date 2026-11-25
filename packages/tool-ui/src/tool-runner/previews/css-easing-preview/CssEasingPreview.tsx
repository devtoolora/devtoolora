import { easingPresets, type BezierPoints } from '@devtoolora/functions/css';
import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
  type ReactElement,
  type RefObject,
} from 'react';
import styles from './CssEasingPreview.module.scss';
import { MotionTrack } from './EasingMotionTrack';
import {
  clampPoint,
  plotFrame,
  plotRange,
  plotView,
  toSvg,
  type PlotFrame,
  type Point,
  type YRange,
} from './easingPlotGeometry';
import { useEasedRange } from './useEasedRange';

type CssEasingPreviewProps = {
  css?: string;
  fields: Record<string, string>;
  onFieldChange(id: string, value: string): void;
};

const pointIds = ['x1', 'y1', 'x2', 'y2'];
const arrowMoves: Record<string, Point> = {
  ArrowDown: [0, -1],
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, 1],
};

function fieldPoints(fields: Record<string, string>): BezierPoints | undefined {
  const preset = fields.preset ?? 'custom';

  if (preset !== 'custom')
    return Object.hasOwn(easingPresets, preset) ? easingPresets[preset] : undefined;

  const values = pointIds.map((id) => Number(fields[id]?.trim() || Number.NaN));
  const isInRange = (value: number, index: number): boolean =>
    index % 2 === 0 ? value >= 0 && value <= 1 : value >= -1 && value <= 2;

  return values.every(isInRange) ? (values as BezierPoints) : undefined;
}

type DragStart = {
  clientX: number;
  clientY: number;
  point: Point;
  scale: number;
};

/**
 * Drags follow the pointer's movement at the scale captured on pointerdown, so an off-centre grab
 * never makes the handle jump and a layout shift mid-drag never changes the speed.
 */
function dragStart(
  svg: SVGSVGElement | null,
  unit: number,
  point: Point,
  { clientX, clientY }: { clientX: number; clientY: number },
): DragStart | undefined {
  const bounds = svg?.getBoundingClientRect();

  if (!bounds?.width || !bounds.height) return;

  // The SVG letterboxes its viewBox (xMidYMid meet), so the tighter axis sets the scale.
  const pixelsPerUnit =
    Math.min(bounds.width / plotView.width, bounds.height / plotView.height) * unit;

  return { clientX, clientY, point, scale: 1 / pixelsPerUnit };
}

const draggedPoint = (start: DragStart, clientX: number, clientY: number): Point =>
  clampPoint([
    start.point[0] + (clientX - start.clientX) * start.scale,
    start.point[1] - (clientY - start.clientY) * start.scale,
  ]);

/** Chrome ignores touch-action on SVG children, so a touch on a handle cancels the page pan. */
function useCancelledTouchPan(element: RefObject<SVGGElement | null>): void {
  useEffect(() => {
    const target = element.current;
    const handleTouchStart = (event: TouchEvent): void => event.preventDefault();

    target?.addEventListener('touchstart', handleTouchStart, { passive: false });

    return () => target?.removeEventListener('touchstart', handleTouchStart);
  }, [element]);
}

type EasingHandleProps = {
  frame: PlotFrame;
  index: 1 | 2;
  point: Point;
  svg: RefObject<SVGSVGElement | null>;
  onDraggingChange(isDragging: boolean): void;
  onMove(point: Point): void;
};

function EasingHandle({
  frame,
  index,
  point,
  svg,
  onDraggingChange,
  onMove,
}: EasingHandleProps): ReactElement {
  const drag = useRef<DragStart | undefined>(undefined);
  const element = useRef<SVGGElement>(null);

  useCancelledTouchPan(element);
  const [cx, cy] = toSvg(frame, point);

  const handleKeyDown = (event: KeyboardEvent<SVGGElement>): void => {
    const move = Object.hasOwn(arrowMoves, event.key) ? arrowMoves[event.key] : undefined;

    if (!move) return;

    event.preventDefault();
    const step = event.shiftKey ? 0.1 : 0.01;

    onMove(clampPoint([point[0] + move[0] * step, point[1] + move[1] * step]));
  };

  const handlePointerDown = (event: PointerEvent<SVGGElement>): void => {
    if (event.button !== 0) return;

    drag.current = dragStart(svg.current, frame.unit, point, event);
    onDraggingChange(Boolean(drag.current));
    event.currentTarget.setPointerCapture(event.pointerId);
    event.currentTarget.focus();
  };

  const handlePointerMove = (event: PointerEvent<SVGGElement>): void => {
    if (drag.current) onMove(draggedPoint(drag.current, event.clientX, event.clientY));
  };

  const handleDragEnd = (): void => {
    drag.current = undefined;
    onDraggingChange(false);
  };

  return (
    <g
      aria-label={`Control point ${index}`}
      aria-roledescription="2D slider"
      aria-valuemax={1}
      aria-valuemin={0}
      aria-valuenow={point[0]}
      aria-valuetext={`x ${point[0]}, y ${point[1]}`}
      className={styles.handle}
      ref={element}
      role="slider"
      tabIndex={0}
      onKeyDown={handleKeyDown}
      onLostPointerCapture={handleDragEnd}
      onPointerCancel={handleDragEnd}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handleDragEnd}
    >
      <circle className={styles.hitArea} cx={cx} cy={cy} r={16} />
      <circle className={styles.focusRing} cx={cx} cy={cy} r={11} />
      <circle className={styles.knob} cx={cx} cy={cy} r={7} />
    </g>
  );
}

const tickValues = [2, 1.5, 1, 0.5, 0, -0.5, -1];

function PlotGrid({ frame }: { frame: PlotFrame }): ReactElement {
  const [bottom, top] = frame.range;
  const { left, unit } = frame;
  const [, bandTop] = toSvg(frame, [0, top]);
  const [, axisY] = toSvg(frame, [0, bottom]);
  const [, zeroY] = toSvg(frame, [0, 0]);
  const [right, oneY] = toSvg(frame, [1, 1]);

  return (
    <>
      <rect className={styles.band} height={axisY - bandTop} width={unit} x={left} y={bandTop} />
      <rect className={styles.unit} height={unit} width={unit} x={left} y={oneY} />
      <line className={styles.guide} x1={left} x2={right} y1={zeroY} y2={zeroY} />
      <line className={styles.guide} x1={left} x2={right} y1={oneY} y2={oneY} />
      <line className={styles.linear} x1={left} x2={right} y1={zeroY} y2={oneY} />
      {tickValues
        .filter((value) => value >= bottom && value <= top)
        .map((value) => (
          <text
            className={styles.tick}
            key={value}
            textAnchor="end"
            x={left - 6}
            y={toSvg(frame, [0, value])[1] + 3}
          >
            {value}
          </text>
        ))}
      <text className={styles.tick} textAnchor="middle" x={left} y={axisY + 14}>
        0
      </text>
      <text className={styles.tick} textAnchor="middle" x={right} y={axisY + 14}>
        1
      </text>
      <text className={styles.axis} textAnchor="middle" x={left + unit / 2} y={axisY + 28}>
        time
      </text>
      <text
        className={styles.axis}
        textAnchor="middle"
        transform="rotate(-90)"
        x={-(bandTop + axisY) / 2}
        y={left - 36}
      >
        progress
      </text>
    </>
  );
}

function widenRange([bottom, top]: YRange, y: number | undefined): YRange {
  if (y === undefined) return [bottom, top];

  return [Math.max(-1, Math.min(bottom, y - 0.1)), Math.min(2, Math.max(top, y + 0.1))];
}

type EasingPlotProps = {
  points: BezierPoints;
  onPointsChange(points: BezierPoints): void;
};

function EasingPlot({ points, onPointsChange }: EasingPlotProps): ReactElement {
  const svg = useRef<SVGSVGElement>(null);
  // The range holds still while a handle is dragged, so the handle stays under the pointer;
  // it eases to the new fit when the drag ends. The SVG clips anything dragged past its box.
  const [dragRange, setDragRange] = useState<YRange>();
  const [dragY, setDragY] = useState<number>();
  const target = dragRange ? widenRange(dragRange, dragY) : plotRange(points);
  const range = useEasedRange(target);
  const frame = plotFrame(range);
  const [x1, y1, x2, y2] = points;
  const start = toSvg(frame, [0, 0]);
  const end = toSvg(frame, [1, 1]);
  const [p1x, p1y] = toSvg(frame, [x1, y1]);
  const [p2x, p2y] = toSvg(frame, [x2, y2]);

  const handleDraggingChange = (isDragging: boolean): void => {
    setDragRange(isDragging ? range : undefined);
    setDragY(undefined);
  };

  const handleMove = (point: Point, next: BezierPoints): void => {
    setDragY(point[1]);
    onPointsChange(next);
  };

  return (
    <svg
      aria-label="Easing curve: time on the x axis, progress on the y axis"
      className={styles.plot}
      data-y-max={target[1]}
      data-y-min={target[0]}
      ref={svg}
      role="group"
      viewBox={`0 0 ${plotView.width} ${plotView.height}`}
    >
      <PlotGrid frame={frame} />
      <line className={styles.arm} x1={start[0]} x2={p1x} y1={start[1]} y2={p1y} />
      <line className={styles.arm} x1={end[0]} x2={p2x} y1={end[1]} y2={p2y} />
      <path
        className={styles.curve}
        d={`M${start.join(' ')} C${p1x} ${p1y} ${p2x} ${p2y} ${end.join(' ')}`}
      />
      <EasingHandle
        frame={frame}
        index={1}
        point={[x1, y1]}
        svg={svg}
        onDraggingChange={handleDraggingChange}
        onMove={(point) => handleMove(point, [point[0], point[1], x2, y2])}
      />
      <EasingHandle
        frame={frame}
        index={2}
        point={[x2, y2]}
        svg={svg}
        onDraggingChange={handleDraggingChange}
        onMove={(point) => handleMove(point, [x1, y1, point[0], point[1]])}
      />
    </svg>
  );
}

export function CssEasingPreview({
  css,
  fields,
  onFieldChange,
}: CssEasingPreviewProps): ReactElement {
  const points = fieldPoints(fields);

  const handlePointsChange = (next: BezierPoints): void => {
    onFieldChange('preset', 'custom');
    onFieldChange('x1', String(next[0]));
    onFieldChange('y1', String(next[1]));
    onFieldChange('x2', String(next[2]));
    onFieldChange('y2', String(next[3]));
  };

  return (
    <section aria-label="Easing preview" className={styles.preview}>
      <div className={styles.heading}>
        <h3>Live preview</h3>
        <span>{points ? `cubic-bezier(${points.join(', ')})` : 'Invalid curve'}</span>
      </div>
      <div className={styles.viewport} data-css-preview="easing">
        {points ? (
          <>
            <EasingPlot points={points} onPointsChange={handlePointsChange} />
            <MotionTrack css={css} />
          </>
        ) : (
          <p>Waiting for valid CSS…</p>
        )}
      </div>
      <p className={styles.caption}>
        Drag a control point, or focus it and use the arrow keys (Shift moves 0.1). Moving a point
        switches to Custom curve. The plot and track are not exported.
      </p>
    </section>
  );
}

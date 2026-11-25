import { type PolygonPoint } from '@devtoolora/functions/css';
import { useRef, type PointerEvent, type RefObject } from 'react';
import { canvasPoint, movedPolygon, type PolygonMove } from './clipGeometry';

type CanvasDragOptions = {
  adding: boolean;
  isPolygon: boolean;
  points: PolygonPoint[];
  onCenterChange(point: PolygonPoint): void;
  onPointChange(index: number, point: PolygonPoint): void;
  onPointsChange(points: PolygonPoint[]): void;
};

export type CanvasDrag = {
  canvas: RefObject<HTMLDivElement | null>;
  handleDragEnd(): void;
  handleDragStart(handle: number | 'center'): void;
  handleHandleMove(event: PointerEvent<HTMLButtonElement>): void;
  handleMoveEnd(): void;
  handleShapeMove(event: PointerEvent<HTMLDivElement>): void;
  handleShapePointerDown(event: PointerEvent<HTMLDivElement>): void;
  pointAt(clientX: number, clientY: number): PolygonPoint | undefined;
};

export function useCanvasDrag({
  adding,
  isPolygon,
  points,
  onCenterChange,
  onPointChange,
  onPointsChange,
}: CanvasDragOptions): CanvasDrag {
  const canvas = useRef<HTMLDivElement>(null);
  const dragging = useRef<number | 'center' | undefined>(undefined);
  const moving = useRef<PolygonMove | undefined>(undefined);
  const pointAt = (clientX: number, clientY: number): PolygonPoint | undefined =>
    canvasPoint(canvas.current, clientX, clientY);

  const handleHandleMove = (event: PointerEvent<HTMLButtonElement>): void => {
    if (dragging.current === undefined) return;

    const point = pointAt(event.clientX, event.clientY);

    if (!point) return;
    if (dragging.current === 'center') onCenterChange(point);
    else onPointChange(dragging.current, point);
  };

  const handleShapeMove = (event: PointerEvent<HTMLDivElement>): void => {
    const start = moving.current;
    const point = pointAt(event.clientX, event.clientY);

    if (!start || !point) return;

    onPointsChange(movedPolygon(start, point));
  };

  const handleShapePointerDown = (event: PointerEvent<HTMLDivElement>): void => {
    const origin = pointAt(event.clientX, event.clientY);

    if (!isPolygon || adding || !origin) return;

    moving.current = { origin, points };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  return {
    canvas,
    handleDragEnd: () => {
      dragging.current = undefined;
    },
    handleHandleMove,
    handleMoveEnd: () => {
      moving.current = undefined;
    },
    handleShapeMove,
    handleShapePointerDown,
    pointAt,
    handleDragStart: (handle) => {
      dragging.current = handle;
    },
  };
}

import { MAX_POLYGON_POINTS, type PolygonPoint } from '@devtoolora/functions/css';
import { type MouseEvent, type ReactElement } from 'react';
import { ClipHandle, ClipLayers, type Surface } from './CssClipEditorParts';
import styles from './CssClipEditor.module.scss';
import { type CanvasDrag, useCanvasDrag } from './useCanvasDrag';

type ClipCanvasProps = {
  active: number;
  adding: boolean;
  center: PolygonPoint;
  error: string;
  image: string;
  isPolygon: boolean;
  points: PolygonPoint[];
  shape: string;
  showOutside: boolean;
  surface: Surface;
  value?: string;
  onCenterChange(point: PolygonPoint): void;
  onPointAdd(point: PolygonPoint): void;
  onPointChange(index: number, point: PolygonPoint): void;
  onPointsChange(points: PolygonPoint[]): void;
  onPointSelect(index: number): void;
};

function isAddPointClick(
  event: MouseEvent<HTMLDivElement>,
  { adding, isPolygon, points }: Pick<ClipCanvasProps, 'adding' | 'isPolygon' | 'points'>,
): boolean {
  return (
    isPolygon &&
    adding &&
    points.length >= 3 &&
    points.length < MAX_POLYGON_POINTS &&
    !(event.target as HTMLElement).closest('button')
  );
}

type ClipHandlesProps = Pick<
  ClipCanvasProps,
  'active' | 'center' | 'isPolygon' | 'points' | 'shape' | 'value'
> & {
  drag: CanvasDrag;
  onCenterChange(point: PolygonPoint): void;
  onPointChange(index: number, point: PolygonPoint): void;
  onPointSelect(index: number): void;
};

function ClipHandles({
  active,
  center,
  drag,
  isPolygon,
  points,
  shape,
  value,
  onCenterChange,
  onPointChange,
  onPointSelect,
}: ClipHandlesProps): ReactElement {
  return (
    <>
      {isPolygon &&
        points.map((point, index) => (
          <ClipHandle
            key={index}
            label={`Polygon point ${index + 1}`}
            point={point}
            pressed={index === active}
            onDragEnd={drag.handleDragEnd}
            onDragMove={drag.handleHandleMove}
            onDragStart={() => {
              drag.handleDragStart(index);
              onPointSelect(index);
            }}
            onFocus={() => onPointSelect(index)}
            onMove={(next) => onPointChange(index, next)}
          >
            {index + 1}
          </ClipHandle>
        ))}
      {value && (shape === 'circle' || shape === 'ellipse') && (
        <ClipHandle
          label="Shape center"
          point={center}
          onDragEnd={drag.handleDragEnd}
          onDragMove={drag.handleHandleMove}
          onDragStart={() => drag.handleDragStart('center')}
          onMove={onCenterChange}
        >
          +
        </ClipHandle>
      )}
    </>
  );
}

export function ClipCanvas(props: ClipCanvasProps): ReactElement {
  const { adding, error, image, isPolygon, points, showOutside, surface, value, onPointAdd } =
    props;
  const drag = useCanvasDrag(props);

  const handleCanvasClick = (event: MouseEvent<HTMLDivElement>): void => {
    if (!isAddPointClick(event, props)) return;

    const point = drag.pointAt(event.clientX, event.clientY);

    if (point) onPointAdd(point);
  };

  return (
    <div
      aria-label={isPolygon ? 'Polygon canvas' : 'Shape canvas'}
      className={styles.canvas}
      ref={drag.canvas}
      onClick={handleCanvasClick}
    >
      <ClipLayers
        image={image}
        isMovable={isPolygon && !adding}
        showOutside={showOutside}
        surface={surface}
        value={value}
        onMove={drag.handleShapeMove}
        onMoveEnd={drag.handleMoveEnd}
        onMoveStart={drag.handleShapePointerDown}
      />
      {error && (
        <p className={styles.error}>
          {error}{' '}
          {isPolygon
            ? 'Repair Points JSON or choose a preset.'
            : 'Fix the value or choose a preset.'}
        </p>
      )}
      <ClipHandles
        active={props.active}
        center={props.center}
        drag={drag}
        isPolygon={isPolygon}
        points={points}
        shape={props.shape}
        value={value}
        onCenterChange={props.onCenterChange}
        onPointChange={props.onPointChange}
        onPointSelect={props.onPointSelect}
      />
    </div>
  );
}

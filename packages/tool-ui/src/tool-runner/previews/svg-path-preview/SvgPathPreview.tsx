import type { ToolResult } from '@devtoolora/core';
import type { ReactElement } from 'react';
import styles from './SvgPathPreview.module.scss';

type SvgPath = NonNullable<ToolResult['svgPath']>;
type PathPoint = SvgPath['points'][number];

type SvgPathPreviewProps = { path: SvgPath };
type PointOverlayProps = { points: PathPoint[]; unit: number };

const MAX_POINTS = 2000;
// shortcut: markers are sized for this nominal render width; they shrink with the SVG in narrower
// containers. Measure the rendered size with a ResizeObserver if that ever matters.
const NOMINAL_SIZE = 320;
const END_RADIUS = 4;
const CONTROL_SIZE = 7;
// The serializer writes only command letters, digits, '-', '.' and whitespace.
const SAFE_PATH_DATA = /^[MLHVCSQTAZmlhvcsqtaz0-9.\-\s]*$/;

const displayClasses: Record<SvgPath['display'], string | undefined> = {
  fill: styles.fill,
  stroke: styles.stroke,
};

const coordinate = (value: number): string => String(Math.round(value * 1000) / 1000);

function PointOverlay({ points, unit }: PointOverlayProps): ReactElement {
  const side = CONTROL_SIZE * unit;

  return (
    <g>
      {points.map(
        (point, index) =>
          point.anchor && (
            <line
              className={styles.handle}
              key={`handle-${index}`}
              x1={point.anchor.x}
              x2={point.x}
              y1={point.anchor.y}
              y2={point.y}
            />
          ),
      )}

      {points.map((point, index) =>
        point.kind === 'end' ? (
          <circle
            className={styles.endPoint}
            cx={point.x}
            cy={point.y}
            key={`point-${index}`}
            r={END_RADIUS * unit}
          />
        ) : (
          <rect
            className={styles.controlPoint}
            height={side}
            key={`point-${index}`}
            width={side}
            x={point.x - side / 2}
            y={point.y - side / 2}
          />
        ),
      )}
    </g>
  );
}

export function SvgPathPreview({ path }: SvgPathPreviewProps): ReactElement | null {
  if (!SAFE_PATH_DATA.test(path.d)) return null;

  const { bbox } = path;
  const padding = Math.max(bbox.width, bbox.height) * 0.05 || 1;
  const width = bbox.width + padding * 2;
  const height = bbox.height + padding * 2;
  const unit = Math.max(width, height) / NOMINAL_SIZE;
  const isOverlayHidden = path.pointCount > MAX_POINTS;

  return (
    <section aria-label="Path preview" className={styles.preview}>
      <div className={styles.stage}>
        <svg
          aria-hidden="true"
          className={styles.canvas}
          height={height / unit}
          viewBox={`${bbox.x - padding} ${bbox.y - padding} ${width} ${height}`}
          width={width / unit}
        >
          <path className={`${styles.shape} ${displayClasses[path.display]}`} d={path.d} />

          {!isOverlayHidden && <PointOverlay points={path.points} unit={unit} />}
        </svg>
      </div>

      {isOverlayHidden ? (
        <p className={styles.note}>
          {`${path.pointCount.toLocaleString('en-US')} points; the overlay shows up to 2,000.`}
        </p>
      ) : (
        <ol className={styles.srOnly}>
          {path.points.map((point, index) => (
            <li key={index}>
              {`Point ${index + 1}: ${point.kind} of command ${point.index} at ${coordinate(point.x)}, ${coordinate(point.y)}`}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

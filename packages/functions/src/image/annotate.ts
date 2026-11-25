import { parseCssColor } from '../color/cssColor';
import type { Annotation } from './annotations';

export type AnnotateOptions = {
  color: string;
  commands: Annotation[];
  font: 'monospace' | 'sans-serif' | 'serif';
  fontSize: number;
  width: number;
};

type Context = OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D;

export function drawAnnotations(context: Context, options: AnnotateOptions): void {
  const { r, g, b } = parseCssColor(options.color);
  const contrast = (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.5 ? '#000000' : '#ffffff';
  const pad = options.fontSize / 4;

  context.font = `${options.fontSize}px ${options.font}`;
  context.textAlign = 'left';
  context.textBaseline = 'top';
  context.lineJoin = 'round';
  context.lineCap = 'round';

  for (const command of options.commands) {
    context.globalAlpha = 1;
    context.fillStyle = options.color;
    context.strokeStyle = options.color;
    context.lineWidth = options.width;

    if (command.kind === 'text') {
      context.strokeStyle = contrast;
      context.lineWidth = options.fontSize / 8;
      context.strokeText(command.message, command.x, command.y);
      context.fillText(command.message, command.x, command.y);
    } else if (command.kind === 'label') {
      const width = context.measureText(command.message).width + pad * 2;

      context.beginPath();
      context.roundRect(command.x, command.y, width, options.fontSize + pad * 2, pad);
      context.fill();
      context.fillStyle = contrast;
      context.fillText(command.message, command.x + pad, command.y + pad);
    } else if (command.kind === 'rect') {
      context.strokeRect(command.x, command.y, command.width, command.height);
    } else if (command.kind === 'highlight') {
      context.globalAlpha = 0.35;
      context.fillRect(command.x, command.y, command.width, command.height);
    } else if (command.kind === 'redact') {
      context.fillStyle = '#000000';
      redact(context, command);
    } else if (command.kind === 'arrow') {
      drawArrow(context, command, options.width);
    } else if (command.kind === 'circle') {
      context.beginPath();
      context.arc(command.x, command.y, command.r, 0, Math.PI * 2);
      context.stroke();
    }
  }

  context.globalAlpha = 1;
}

/** Rounds outward to whole pixels so no half-blended edge keeps a trace of the covered content. */
function redact(context: Context, box: Extract<Annotation, { height: number }>): void {
  const left = Math.floor(box.x);
  const top = Math.floor(box.y);

  context.fillRect(
    left,
    top,
    Math.ceil(box.x + box.width) - left,
    Math.ceil(box.y + box.height) - top,
  );
}

function drawArrow(
  context: Context,
  { x1, x2, y1, y2 }: Extract<Annotation, { kind: 'arrow' }>,
  width: number,
): void {
  const head = Math.max(12, 4 * width);
  const angle = Math.atan2(y2 - y1, x2 - x1);
  const side = (offset: number): [number, number] => [
    x2 - head * Math.cos(angle + offset),
    y2 - head * Math.sin(angle + offset),
  ];
  const shaft = Math.hypot(x2 - x1, y2 - y1) - head * 0.8;

  if (shaft > 0) {
    context.beginPath();
    context.moveTo(x1, y1);
    context.lineTo(x1 + shaft * Math.cos(angle), y1 + shaft * Math.sin(angle));
    context.stroke();
  }

  context.beginPath();
  context.moveTo(x2, y2);
  context.lineTo(...side(Math.PI / 7));
  context.lineTo(...side(-Math.PI / 7));
  context.closePath();
  context.fill();
}

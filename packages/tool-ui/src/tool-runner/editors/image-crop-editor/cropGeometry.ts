import { type CSSProperties } from 'react';

export type CropState = {
  height: number;
  width: number;
  x: number;
  y: number;
};

export type DragMode = 'move' | 'resize';

export function defaultCrop(): CropState {
  return { height: 0.6, width: 0.6, x: 0.2, y: 0.2 };
}

function clampCrop(next: CropState): CropState {
  const width = Math.min(Math.max(next.width, 0.05), 1);
  const height = Math.min(Math.max(next.height, 0.05), 1);

  return {
    height,
    width,
    x: Math.min(Math.max(next.x, 0), 1 - width),
    y: Math.min(Math.max(next.y, 0), 1 - height),
  };
}

function parseAspectRatio(value: string | undefined): number | null {
  if (!value || value === 'free') {
    return null;
  }

  const match = value.match(/^(\d+):(\d+)$/);

  return match ? Number(match[1]) / Number(match[2]) : null;
}

export type NaturalSize = { height: number; width: number };

export function constrainAspect(
  state: CropState,
  aspect: string | undefined,
  naturalSize: NaturalSize,
  anchor: 'reset' | 'size' = 'size',
): CropState {
  const ratio = parseAspectRatio(aspect);

  if (!ratio || !naturalSize.width || !naturalSize.height) {
    return clampCrop(state);
  }

  const normalizedRatio = ratio / (naturalSize.width / naturalSize.height);
  let width = state.width;
  let height = state.height;

  if (anchor === 'reset') {
    width = Math.min(0.8, normalizedRatio >= 1 ? 0.8 : 0.8 * normalizedRatio);
    height = Math.min(0.8, normalizedRatio >= 1 ? 0.8 / normalizedRatio : 0.8);
  } else {
    height = width / normalizedRatio;

    if (height > 1) {
      height = Math.min(state.height, 1);
      width = height * normalizedRatio;
    }
  }

  return clampCrop({ ...state, height, width });
}

export function cropPixels(crop: CropState, size: NaturalSize): Array<[string, string]> {
  return [
    ['cropX', String(Math.round(crop.x * size.width))],
    ['cropY', String(Math.round(crop.y * size.height))],
    ['cropWidth', String(Math.max(1, Math.round(crop.width * size.width)))],
    ['cropHeight', String(Math.max(1, Math.round(crop.height * size.height)))],
  ];
}

export function draggedCrop(
  mode: DragMode,
  startCrop: CropState,
  deltaX: number,
  deltaY: number,
  constrain: (state: CropState) => CropState,
): CropState {
  if (mode === 'move') {
    return clampCrop({ ...startCrop, x: startCrop.x + deltaX, y: startCrop.y + deltaY });
  }

  return constrain({
    ...startCrop,
    height: Math.max(0.05, startCrop.height + deltaY),
    width: Math.max(0.05, startCrop.width + deltaX),
  });
}

export function cropBoxStyle(crop: CropState): CSSProperties {
  return {
    height: `${crop.height * 100}%`,
    left: `${crop.x * 100}%`,
    top: `${crop.y * 100}%`,
    width: `${crop.width * 100}%`,
  };
}

export function pickedPixel(
  clientX: number,
  clientY: number,
  rect: DOMRect,
  size: NaturalSize,
): [number, number] {
  return [
    Math.min(
      size.width - 1,
      Math.max(0, Math.round(((clientX - rect.left) / rect.width) * size.width)),
    ),
    Math.min(
      size.height - 1,
      Math.max(0, Math.round(((clientY - rect.top) / rect.height) * size.height)),
    ),
  ];
}

export const cancelledCropFields: Array<[string, string]> = [
  ['cropMode', 'none'],
  ['cropX', ''],
  ['cropY', ''],
  ['cropWidth', ''],
  ['cropHeight', ''],
];

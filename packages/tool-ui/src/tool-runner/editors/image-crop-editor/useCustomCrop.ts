import {
  useEffect,
  useEffectEvent,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
  type RefObject,
} from 'react';
import {
  constrainAspect,
  cropPixels,
  type CropState,
  defaultCrop,
  draggedCrop,
  type DragMode,
  type NaturalSize,
} from './cropGeometry';

type CropDrag = {
  imageRect: DOMRect;
  mode: DragMode;
  startCrop: CropState;
  startX: number;
  startY: number;
};

const arrowMoves: Record<string, [number, number]> = {
  ArrowDown: [0, 1],
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, -1],
};

type CropBoxHandlers = Pick<
  CustomCrop,
  | 'handleCropBoxKeyDown'
  | 'handleCropBoxPointerDown'
  | 'handleCropBoxPointerEnd'
  | 'handleCropBoxPointerMove'
>;

function useCropBoxHandlers(
  crop: CropState,
  imageRef: RefObject<HTMLImageElement | null>,
  constrain: (state: CropState) => CropState,
  onCropChange: (crop: CropState) => void,
): CropBoxHandlers {
  const dragRef = useRef<CropDrag | null>(null);

  const handleCropBoxPointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    if (!imageRef.current) return;

    const boxRect = event.currentTarget.getBoundingClientRect();
    const isResize = event.clientX >= boxRect.right - 14 && event.clientY >= boxRect.bottom - 14;

    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);

    dragRef.current = {
      imageRect: imageRef.current.getBoundingClientRect(),
      mode: isResize ? 'resize' : 'move',
      startCrop: crop,
      startX: event.clientX,
      startY: event.clientY,
    };
  };

  const handleCropBoxPointerMove = (event: PointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current;

    if (!drag) return;

    const deltaX = (event.clientX - drag.startX) / drag.imageRect.width;
    const deltaY = (event.clientY - drag.startY) / drag.imageRect.height;

    onCropChange(draggedCrop(drag.mode, drag.startCrop, deltaX, deltaY, constrain));
  };

  const handleCropBoxPointerEnd = () => {
    dragRef.current = null;
  };

  const handleCropBoxKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    const move = Object.hasOwn(arrowMoves, event.key) ? arrowMoves[event.key] : undefined;

    if (!move) return;

    event.preventDefault();
    const step = event.shiftKey ? 0.1 : 0.01;

    onCropChange(draggedCrop('move', crop, move[0] * step, move[1] * step, constrain));
  };

  return {
    handleCropBoxKeyDown,
    handleCropBoxPointerDown,
    handleCropBoxPointerEnd,
    handleCropBoxPointerMove,
  };
}

type CustomCropOptions = {
  fields: Record<string, string>;
  imageRef: RefObject<HTMLImageElement | null>;
  naturalSize: NaturalSize;
  onFieldChange(fieldId: string, value: string): void;
};

export type CustomCrop = {
  crop: CropState;
  handleCropBoxKeyDown(event: KeyboardEvent<HTMLButtonElement>): void;
  handleCropBoxPointerDown(event: PointerEvent<HTMLButtonElement>): void;
  handleCropBoxPointerEnd(): void;
  handleCropBoxPointerMove(event: PointerEvent<HTMLButtonElement>): void;
  handleImageLoaded(size: NaturalSize): void;
  handleResetCrop(): void;
};

export function useCustomCrop({
  fields,
  imageRef,
  naturalSize,
  onFieldChange,
}: CustomCropOptions): CustomCrop {
  const [crop, setCrop] = useState<CropState>(defaultCrop);
  const isCustomCrop = fields.cropMode === 'custom';

  const constrain = (state: CropState, anchor: 'reset' | 'size' = 'size'): CropState =>
    constrainAspect(state, fields.cropAspect, naturalSize, anchor);

  const writeCrop = (nextCrop: CropState, size: NaturalSize) => {
    for (const [fieldId, value] of cropPixels(nextCrop, size)) onFieldChange(fieldId, value);
  };

  const syncCropCoordinates = (nextCrop: CropState) => {
    if (naturalSize.width && naturalSize.height) writeCrop(nextCrop, naturalSize);
  };

  const handleImageLoaded = (size: NaturalSize) => {
    if (isCustomCrop) {
      const initial = constrainAspect(defaultCrop(), fields.cropAspect, size, 'reset');

      setCrop(initial);
      writeCrop(initial, size);
    }
  };

  const applyCrop = (nextCrop: CropState) => {
    setCrop(nextCrop);
    syncCropCoordinates(nextCrop);
  };

  const handleAspectChange = useEffectEvent(() => {
    if (isCustomCrop && naturalSize.width && naturalSize.height) applyCrop(constrain(crop));
  });

  const handleModeChange = useEffectEvent(() => {
    if (isCustomCrop && naturalSize.width && naturalSize.height && !fields.cropWidth)
      applyCrop(constrain(defaultCrop(), 'reset'));
  });

  useEffect(() => handleAspectChange(), [fields.cropAspect]);
  useEffect(() => handleModeChange(), [fields.cropMode]);

  const cropBoxHandlers = useCropBoxHandlers(crop, imageRef, constrain, applyCrop);

  const handleResetCrop = () => applyCrop(constrain(defaultCrop(), 'reset'));

  return { ...cropBoxHandlers, crop, handleImageLoaded, handleResetCrop };
}

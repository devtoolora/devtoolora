import { useRef, useState, type MouseEvent as ReactMouseEvent, type RefObject } from 'react';
import { cancelledCropFields, type NaturalSize, pickedPixel } from './cropGeometry';
import { type ImageCropEditorProps } from './types';
import { type CustomCrop, useCustomCrop } from './useCustomCrop';

type SourceImage = {
  customCrop: CustomCrop;
  handleCancelCrop(): void;
  handleImageClick(event: ReactMouseEvent<HTMLImageElement>): void;
  handleImageLoad(): void;
  imageRef: RefObject<HTMLImageElement | null>;
  operation: string;
};

export function useSourceImage(
  fields: Record<string, string>,
  onFieldChange: ImageCropEditorProps['onFieldChange'],
): SourceImage {
  const imageRef = useRef<HTMLImageElement>(null);
  const [naturalSize, setNaturalSize] = useState<NaturalSize>({
    height: 0,
    width: 0,
  });
  const customCrop = useCustomCrop({ fields, imageRef, naturalSize, onFieldChange });
  const operation = fields.operation ?? 'transform';

  const handleImageLoad = () => {
    if (!imageRef.current) {
      return;
    }

    const width = imageRef.current.naturalWidth;
    const height = imageRef.current.naturalHeight;

    setNaturalSize({ height, width });
    customCrop.handleImageLoaded({ height, width });
  };

  const handleImageClick = (event: ReactMouseEvent<HTMLImageElement>) => {
    if (
      operation !== 'color-picker' ||
      !imageRef.current ||
      !naturalSize.width ||
      !naturalSize.height
    ) {
      return;
    }

    const rect = imageRef.current.getBoundingClientRect();
    const [x, y] = pickedPixel(event.clientX, event.clientY, rect, naturalSize);

    onFieldChange('colorX', String(x));
    onFieldChange('colorY', String(y));
  };

  const handleCancelCrop = () => {
    for (const [fieldId, value] of cancelledCropFields) onFieldChange(fieldId, value);
  };

  return {
    customCrop,
    handleCancelCrop,
    handleImageClick,
    handleImageLoad,
    imageRef,
    operation,
  };
}

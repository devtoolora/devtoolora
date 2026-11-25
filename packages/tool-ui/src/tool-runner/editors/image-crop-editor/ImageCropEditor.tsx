import { type ReactElement } from 'react';
import { Button } from '../../../ui';
import styles from './ImageCropEditor.module.scss';
import { cropBoxStyle } from './cropGeometry';
import { previewFilter, watermarkStyle } from './previewFilters';
import { type ImageCropEditorProps } from './types';
import { useSourceImage } from './useSourceImage';

type CropActionsProps = { onCancel(): void; onReset(): void };

function CropActions({ onCancel, onReset }: CropActionsProps): ReactElement {
  return (
    <div className={styles.cropActions}>
      <Button id="resetCrop" size="sm" variant="secondary" onClick={onReset}>
        Reset crop
      </Button>
      <Button id="cancelCrop" size="sm" variant="secondary" onClick={onCancel}>
        Cancel crop
      </Button>
    </div>
  );
}

export function ImageCropEditor({
  fields,
  onFieldChange,
}: ImageCropEditorProps): ReactElement | null {
  const source = useSourceImage(fields, onFieldChange);
  const { operation } = source;
  const isCustomCrop = fields.cropMode === 'custom';

  if (!fields.image) {
    return null;
  }

  return (
    <div className={styles.sourcePreview} id="imageSourcePreview">
      <span className={`${styles.hint} meta`}>Uploaded image preview.</span>
      <div className={styles.cropStage}>
        <img
          alt="Uploaded image preview"
          className={`${styles.sourceImage} ${operation === 'color-picker' ? styles.colorPicker : ''}`}
          id="sourceImage"
          ref={source.imageRef}
          src={fields.image}
          style={{ filter: previewFilter(fields, operation) }}
          onClick={source.handleImageClick}
          onLoad={source.handleImageLoad}
        />
        {isCustomCrop && (
          <button
            aria-label="Crop area. Arrow keys move it, Shift moves it further."
            className={styles.cropBox}
            id="cropBox"
            style={cropBoxStyle(source.customCrop.crop)}
            type="button"
            onKeyDown={source.customCrop.handleCropBoxKeyDown}
            onLostPointerCapture={source.customCrop.handleCropBoxPointerEnd}
            onPointerCancel={source.customCrop.handleCropBoxPointerEnd}
            onPointerDown={source.customCrop.handleCropBoxPointerDown}
            onPointerMove={source.customCrop.handleCropBoxPointerMove}
            onPointerUp={source.customCrop.handleCropBoxPointerEnd}
          />
        )}
        {operation === 'watermark' && (
          <div
            className={styles.watermarkPreview}
            data-position={fields.watermarkPosition || 'center'}
            data-testid="watermark-preview"
            style={watermarkStyle(fields)}
          >
            {fields.watermarkText || 'Watermark'}
          </div>
        )}
      </div>
      {isCustomCrop && (
        <CropActions
          onCancel={source.handleCancelCrop}
          onReset={source.customCrop.handleResetCrop}
        />
      )}
    </div>
  );
}

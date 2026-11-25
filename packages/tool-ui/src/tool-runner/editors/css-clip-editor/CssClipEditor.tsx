import { useState, type ReactElement } from 'react';
import { ClipPreviewOptions, shapeValue, type Surface } from './CssClipEditorParts';
import styles from './CssClipEditor.module.scss';
import { ClipCanvas } from './ClipCanvas';
import { ClipEditorControls } from './ClipEditorControls';
import { parseClipShape, selectionText, shapeCenter } from './clipGeometry';
import { type CssClipEditorProps } from './types';
import { useClipPreviewImage } from './useClipPreviewImage';
import { usePolygonEditing } from './usePolygonEditing';

export function CssClipEditor({
  fields,
  samples,
  onFieldChange,
  onSampleApply,
}: CssClipEditorProps): ReactElement {
  const previewImage = useClipPreviewImage();
  const [showOutside, setShowOutside] = useState(false);
  const [surface, setSurface] = useState<Surface>('gradient');
  const shape = fields.shape || 'polygon';
  const isPolygon = shape === 'polygon';
  const { error, points } = parseClipShape(fields, isPolygon);
  const value = error ? undefined : shapeValue(fields);
  const editing = usePolygonEditing(points, onFieldChange, onSampleApply);
  const { image } = previewImage;

  return (
    <section aria-label="Clip-path editor" className={styles.editor}>
      <ClipEditorControls
        editing={editing}
        isPolygon={isPolygon}
        pointCount={points.length}
        samples={samples}
        shape={shape}
        value={value}
      />
      <ClipCanvas
        active={editing.active}
        adding={editing.adding}
        center={shapeCenter(fields)}
        error={error}
        image={image}
        isPolygon={isPolygon}
        points={points}
        shape={shape}
        showOutside={showOutside}
        surface={surface}
        value={value}
        onCenterChange={editing.handleCenterChange}
        onPointAdd={editing.handlePointAdd}
        onPointChange={editing.handlePointChange}
        onPointsChange={editing.handlePointsChange}
        onPointSelect={editing.handlePointSelect}
      />
      <p className={styles.coordinates}>
        {selectionText(isPolygon, points, editing.active, value)}
      </p>
      <ClipPreviewOptions
        image={image}
        imageError={previewImage.imageError}
        imageInputRef={previewImage.imageInputRef}
        showOutside={showOutside}
        surface={surface}
        onImageChange={previewImage.handleImage}
        onImageRemove={previewImage.handleImageRemove}
        onShowOutsideChange={(isShown) => setShowOutside(isShown)}
        onSurfaceChange={(next) => setSurface(next)}
      />
    </section>
  );
}

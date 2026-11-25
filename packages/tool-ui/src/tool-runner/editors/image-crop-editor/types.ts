export type ImageCropEditorProps = {
  fields: Record<string, string>;
  onFieldChange(fieldId: string, value: string): void;
};

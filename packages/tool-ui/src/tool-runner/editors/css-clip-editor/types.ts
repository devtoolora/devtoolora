import type { ToolSample } from '@devtoolora/core';

export type CssClipEditorProps = {
  fields: Record<string, string>;
  samples: ToolSample[];
  onFieldChange(id: string, value: string): void;
  onSampleApply(sample: ToolSample): void;
};

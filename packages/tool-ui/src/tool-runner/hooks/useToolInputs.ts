import type { SerializedToolDefinition, ToolSample } from '@devtoolora/core';
import { useCallback, useEffect, useEffectEvent, useRef, useState } from 'react';

// A new `key` applies the seed again; the same key keeps what the user typed.
export type ToolInputSeed = {
  fields?: Record<string, string>;
  key: string;
  text?: string;
};

function defaults(tool?: SerializedToolDefinition) {
  return Object.fromEntries(
    tool?.fields?.map((field) => [field.id, field.defaultValue ?? '']) ?? [],
  );
}

export function useToolInputs(
  tool?: SerializedToolDefinition,
  seed?: ToolInputSeed,
  onInputsChange?: (text: string, fields: Record<string, string>) => void,
) {
  const [text, setText] = useState(seed?.text ?? '');
  const [fields, setFields] = useState<Record<string, string>>(() => ({
    ...defaults(tool),
    ...seed?.fields,
  }));
  const onInputsChangeRef = useRef(onInputsChange);

  onInputsChangeRef.current = onInputsChange;

  const resetInputs = useEffectEvent(() => {
    setText(seed?.text ?? '');
    setFields({ ...defaults(tool), ...seed?.fields });
  });

  useEffect(() => resetInputs(), [tool?.id, seed?.key]);

  useEffect(() => {
    onInputsChangeRef.current?.(text, fields);
  }, [fields, text]);

  const handleFieldChange = useCallback((fieldId: string, value: string) => {
    setFields((current) => ({ ...current, [fieldId]: value }));
  }, []);

  const handleTextChange = useCallback((value: string) => setText(value), []);

  const applySample = useCallback(
    (sample: ToolSample) => {
      setText(sample.text ?? '');
      setFields({ ...defaults(tool), ...sample.fields });
    },
    [tool],
  );

  const clearInputs = useCallback(() => {
    setText('');
    setFields(defaults(tool));
  }, [tool]);

  return {
    text,
    fields,
    onTextChange: handleTextChange,
    onFieldChange: handleFieldChange,
    onSampleApply: applySample,
    clearInputs,
  };
}

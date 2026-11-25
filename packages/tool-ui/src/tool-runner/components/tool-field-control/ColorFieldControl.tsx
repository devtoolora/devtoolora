import type { ToolField } from '@devtoolora/core';
import { parseCssColor, rgbToHex } from '@devtoolora/functions/color';
import { shadowColor, shadowColorWithOpacity } from '@devtoolora/functions/css';
import { useId, type ReactElement } from 'react';
import styles from './ToolFieldControl.module.scss';

type ColorInputControlProps = {
  help?: string;
  label: string;
  pickerValue: string;
  placeholder?: string;
  value: string;
  onPick(hex: string): void;
  onValueChange(value: string): void;
};

export function ColorInputControl({
  help,
  label,
  pickerValue,
  placeholder,
  value,
  onPick,
  onValueChange,
}: ColorInputControlProps): ReactElement {
  const id = useId();
  const helpId = help ? `${id}-help` : undefined;

  return (
    <div className={`${styles.rangeControl} tool-range-field`}>
      <label htmlFor={id}>{label}</label>
      <div className={styles.colorRow}>
        <input
          aria-describedby={helpId}
          aria-label={`${label} picker`}
          type="color"
          value={pickerValue}
          onChange={(event) => onPick(event.target.value)}
        />
        <input
          aria-describedby={helpId}
          id={id}
          placeholder={placeholder}
          spellCheck={false}
          type="text"
          value={value}
          onChange={(event) => onValueChange(event.target.value)}
        />
      </div>
      {help && (
        <small className={styles.help} id={helpId}>
          {help}
        </small>
      )}
    </div>
  );
}

function swatchColor(value: string, keepsAlpha: boolean): { hex: string; opacity: number } {
  try {
    if (keepsAlpha) return shadowColor(value);

    const { b, g, r } = parseCssColor(value);

    return { hex: rgbToHex({ b: b * 255, g: g * 255, r: r * 255 }), opacity: 1 };
  } catch {
    return { hex: '#808080', opacity: 1 };
  }
}

type ColorFieldControlProps = {
  field: ToolField;
  value: string;
  onValueChange(value: string): void;
};

export function ColorFieldControl({
  field,
  value,
  onValueChange,
}: ColorFieldControlProps): ReactElement {
  const keepsAlpha = !(field.type === 'text' && field.presentation === 'color');
  const color = swatchColor(value || field.defaultValue || '', keepsAlpha);

  return (
    <ColorInputControl
      help={field.help}
      label={field.label}
      pickerValue={color.hex}
      placeholder={'placeholder' in field ? field.placeholder : undefined}
      value={value}
      onPick={(hex) =>
        onValueChange(
          !keepsAlpha || color.opacity === 1
            ? hex.toLowerCase()
            : shadowColorWithOpacity(hex, color.opacity),
        )
      }
      onValueChange={onValueChange}
    />
  );
}

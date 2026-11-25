import { useId, type ReactElement } from 'react';
import styles from './ToolFieldControl.module.scss';

type RangeFieldControlProps = {
  help?: string;
  label: string;
  maximum: number;
  minimum: number;
  presentation?: 'editable' | 'slider';
  step?: number;
  unit?: string;
  value: string;
  onValueChange(value: string): void;
};

export function RangeFieldControl({
  help,
  label,
  maximum,
  minimum,
  presentation = 'editable',
  step = 1,
  unit = '',
  value,
  onValueChange,
}: RangeFieldControlProps): ReactElement {
  const id = useId();
  const helpId = help ? `${id}-help` : undefined;
  const rangeValue =
    value === '' || !Number.isFinite(Number(value))
      ? minimum
      : Math.min(maximum, Math.max(minimum, Number(value)));

  return (
    <div className={`${styles.rangeControl} tool-range-field`}>
      <label htmlFor={id}>{label}</label>
      <div className={styles.rangeRow}>
        <input
          aria-describedby={helpId}
          aria-label={`${label} slider`}
          aria-valuetext={unit ? `${rangeValue} ${unit}` : undefined}
          max={maximum}
          min={minimum}
          step={step}
          type="range"
          value={rangeValue}
          onChange={(event) => onValueChange(event.target.value)}
        />
        {presentation === 'editable' ? (
          <input
            aria-describedby={helpId}
            id={id}
            max={maximum}
            min={minimum}
            step={step}
            type="number"
            value={value}
            onChange={(event) => onValueChange(event.target.value)}
          />
        ) : (
          <output id={id}>{value}</output>
        )}
        {unit && <span>{unit}</span>}
      </div>
      {help && (
        <small className={styles.help} id={helpId}>
          {help}
        </small>
      )}
    </div>
  );
}

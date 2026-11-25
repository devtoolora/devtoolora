import type React from 'react';
import styles from './Input.module.scss';

export type InputSize = 'lg' | 'md' | 'sm';

export interface InputProps extends Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  'onChange' | 'prefix' | 'size'
> {
  autoFocus?: boolean;
  className?: string;
  disabled?: boolean;
  id?: string;
  name?: string;
  placeholder?: string;
  prefix?: React.ReactNode;
  readOnly?: boolean;
  size?: InputSize;
  suffix?: React.ReactNode;
  type?: string;
  value?: string;
  onChange?: (value: string) => void;
  onKeyDown?: React.KeyboardEventHandler<HTMLInputElement>;
}

const sizeClasses: Record<InputSize, string | undefined> = {
  lg: styles.lg,
  md: styles.md,
  sm: styles.sm,
};

export function Input({
  autoFocus = false,
  className,
  disabled = false,
  id,
  name,
  placeholder,
  prefix,
  readOnly = false,
  size = 'md',
  suffix,
  type = 'text',
  value,
  onChange,
  onKeyDown,
  ...rest
}: InputProps): React.JSX.Element {
  const rootClassName = [styles.root, sizeClasses[size], disabled && styles.disabled, className]
    .filter(Boolean)
    .join(' ');

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>): void => {
    if (onChange) {
      onChange(event.target.value);
    }
  };

  return (
    <div className={rootClassName}>
      {prefix && <span className={styles.prefix}>{prefix}</span>}

      <input
        autoFocus={autoFocus}
        className={styles.input}
        disabled={disabled}
        id={id}
        name={name}
        placeholder={placeholder}
        readOnly={readOnly}
        type={type}
        value={value}
        onChange={handleChange}
        onKeyDown={onKeyDown}
        {...rest}
      />

      {suffix && <span className={styles.suffix}>{suffix}</span>}
    </div>
  );
}

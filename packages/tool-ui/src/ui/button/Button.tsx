import type React from 'react';
import styles from './Button.module.scss';

export type ButtonSize = 'lg' | 'md' | 'sm';
export type ButtonVariant = 'ghost' | 'outline' | 'primary' | 'secondary';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children?: React.ReactNode;
  className?: string;
  disabled?: boolean;
  size?: ButtonSize;
  type?: 'button' | 'reset' | 'submit';
  variant?: ButtonVariant;
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
}

const sizeClasses: Record<ButtonSize, string | undefined> = {
  lg: styles.lg,
  md: styles.md,
  sm: styles.sm,
};

const variantClasses: Record<ButtonVariant, string | undefined> = {
  ghost: styles.ghost,
  outline: styles.outline,
  primary: styles.primary,
  secondary: styles.secondary,
};

export function Button({
  children,
  className,
  disabled = false,
  size = 'md',
  type = 'button',
  variant = 'secondary',
  onClick,
  ...rest
}: ButtonProps): React.JSX.Element {
  const combinedClassName = [styles.button, sizeClasses[size], variantClasses[variant], className]
    .filter(Boolean)
    .join(' ');

  return (
    <button
      className={combinedClassName}
      disabled={disabled}
      type={type}
      onClick={onClick}
      {...rest}
    >
      {children}
    </button>
  );
}

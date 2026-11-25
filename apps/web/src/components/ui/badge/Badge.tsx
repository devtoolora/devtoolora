import type React from 'react';
import styles from './Badge.module.scss';

export type BadgeSize = 'md' | 'sm';
export type BadgeVariant = 'calibration' | 'default' | 'muted' | 'signal';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  children?: React.ReactNode;
  className?: string;
  size?: BadgeSize;
  variant?: BadgeVariant;
}

const sizeClasses: Record<BadgeSize, string | undefined> = {
  md: styles.md,
  sm: styles.sm,
};

const variantClasses: Record<BadgeVariant, string | undefined> = {
  calibration: styles.calibration,
  default: styles.default,
  muted: styles.muted,
  signal: styles.signal,
};

export function Badge({
  children,
  className,
  size = 'md',
  variant = 'default',
  ...rest
}: BadgeProps): React.JSX.Element {
  const combinedClassName = [styles.badge, sizeClasses[size], variantClasses[variant], className]
    .filter(Boolean)
    .join(' ');

  return (
    <span className={combinedClassName} {...rest}>
      {children}
    </span>
  );
}

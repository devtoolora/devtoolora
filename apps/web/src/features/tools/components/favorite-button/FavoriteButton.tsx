import { Star } from 'lucide-react';
import type React from 'react';
import styles from './FavoriteButton.module.scss';

type FavoriteButtonSize = 'lg' | 'md' | 'sm';
type FavoriteButtonVariant = 'ghost' | 'outline';

export interface FavoriteButtonProps {
  isFavorite: boolean;
  size?: FavoriteButtonSize;
  toolName: string;
  variant?: FavoriteButtonVariant;
  onToggle(): void;
}

const sizeClasses: Record<FavoriteButtonSize, string | undefined> = {
  lg: styles.lg,
  md: styles.md,
  sm: styles.sm,
};

const variantClasses: Record<FavoriteButtonVariant, string | undefined> = {
  ghost: undefined,
  outline: styles.outline,
};

export function FavoriteButton({
  isFavorite,
  size = 'sm',
  toolName,
  variant = 'ghost',
  onToggle,
}: FavoriteButtonProps): React.JSX.Element {
  const combinedClassName = [
    styles.favoriteButton,
    sizeClasses[size],
    variantClasses[variant],
    isFavorite && styles.isFavorite,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button
      aria-label={`${isFavorite ? 'Remove' : 'Add'} ${toolName} ${isFavorite ? 'from' : 'to'} favorites`}
      aria-pressed={isFavorite}
      className={combinedClassName}
      type="button"
      onClick={onToggle}
    >
      <Star aria-hidden="true" fill={isFavorite ? 'currentColor' : 'none'} size={21} />
    </button>
  );
}

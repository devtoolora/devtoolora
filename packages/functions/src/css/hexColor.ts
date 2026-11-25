import { formatCssColor, parseCssColor } from '../color/cssColor';
import { FunctionError } from '../errors';

export function cssColorHex(value: string, label: string): string {
  const color = parseCssColor(value.trim());

  if (color.alpha < 1) throw new FunctionError('INVALID_COLOR', `${label} must be opaque.`);

  return formatCssColor(color).hex.toLowerCase();
}

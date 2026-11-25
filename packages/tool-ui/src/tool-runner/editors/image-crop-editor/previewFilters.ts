import { type CSSProperties } from 'react';

function colorBlindnessFilter(mode: string): string {
  if (mode === 'achromatopsia') {
    return 'grayscale(1)';
  }

  if (mode === 'tritanopia') {
    return 'sepia(0.35) saturate(0.9) hue-rotate(150deg)';
  }

  if (mode === 'protanopia') {
    return 'sepia(0.25) saturate(0.75) hue-rotate(-20deg)';
  }

  return 'sepia(0.25) saturate(0.8) hue-rotate(20deg)';
}

export function previewFilter(
  fields: Record<string, string>,
  operation: string,
): string | undefined {
  if (operation === 'grayscale') {
    return 'grayscale(1)';
  }

  if (operation === 'filters') {
    const parts = [
      `brightness(${fields.brightness || '1'})`,
      `contrast(${fields.contrast || '1'})`,
      `saturate(${fields.saturation || '1'})`,
    ];
    const blur = Number(fields.blur || '0');

    if (Number.isFinite(blur) && blur > 0) {
      parts.push(`blur(${blur}px)`);
    }

    if (fields.sepia === 'true') {
      parts.push('sepia(1)');
    }

    if (fields.invert === 'true') {
      parts.push('invert(1)');
    }

    return parts.join(' ');
  }

  if (operation === 'color-blindness') {
    return colorBlindnessFilter(fields.colorBlindnessMode || 'deuteranopia');
  }

  return undefined;
}

export function watermarkStyle(fields: Record<string, string>): CSSProperties {
  return {
    color: fields.watermarkColor || '#ffffff',
    fontSize: `${fields.watermarkSize ? Number(fields.watermarkSize) || 28 : 28}px`,
    opacity: fields.watermarkOpacity ? Number(fields.watermarkOpacity) || 0.35 : 0.35,
    transform: `rotate(${fields.watermarkRotation ? Number(fields.watermarkRotation) || -30 : -30}deg)`,
  };
}

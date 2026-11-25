import {
  apcaContrast,
  contrastRatio,
  generatePalette,
  parseColor,
  parsePaletteScheme,
  type PaletteFamily,
} from '@devtoolora/functions/color';
import { useState, type ReactElement } from 'react';
import { copyWithFallback } from '../../components/tool-output-panel/useOutputActions';
import type { ToolPlatformActions } from '../../types';
import styles from './ColorPalettePreview.module.scss';

type ColorPalettePreviewProps = {
  platformActions?: ToolPlatformActions;
  scheme: string;
  text: string;
  valid: boolean;
};

export function ColorPalettePreview({
  platformActions,
  scheme,
  text,
  valid,
}: ColorPalettePreviewProps): ReactElement {
  const [feedback, setFeedback] = useState('');
  let families: PaletteFamily[] = [];

  try {
    if (valid) families = generatePalette(parseColor(text), parsePaletteScheme(scheme));
  } catch {
    /* Main result panel owns validation errors. */
  }

  const handleCopy = async (color: string): Promise<void> => {
    try {
      await copyWithFallback(platformActions, color);

      setFeedback(`Copied ${color}`);
    } catch {
      setFeedback('Copy unavailable. Select the hex value in the JSON report.');
    }
  };

  return (
    <section aria-label="Palette preview" className={styles.preview}>
      <h3>Live color palette</h3>
      {families.length === 0 && <p>Enter a valid opaque color to compare swatches.</p>}
      {families.map((family) => (
        <PaletteFamilySection family={family} key={family.name} onCopy={handleCopy} />
      ))}
      <p aria-live="polite">{feedback}</p>
      <p>
        Click a swatch to copy its hex value. AA labels compare unrounded ratios on pure white/black
        only, not whole-page accessibility.
      </p>
    </section>
  );
}

type PaletteFamilySectionProps = {
  family: PaletteFamily;
  onCopy: (color: string) => Promise<void>;
};

function PaletteFamilySection({ family, onCopy }: PaletteFamilySectionProps): ReactElement {
  const base = parseColor(family.base);
  const white = contrastRatio(base, { b: 255, g: 255, r: 255 });
  const black = contrastRatio(base, { b: 0, g: 0, r: 0 });

  const apcaWhite = apcaContrast(base, { b: 255, g: 255, r: 255 }).toFixed(1);
  const apcaBlack = apcaContrast(base, { b: 0, g: 0, r: 0 }).toFixed(1);

  return (
    <section className={styles.family}>
      <h4>
        {family.name} · {family.base}
      </h4>
      <div className={styles.ladder}>
        {Object.entries(family.shades).map(([step, color]) => {
          const rgb = parseColor(color);
          const foreground =
            contrastRatio(rgb, { b: 255, g: 255, r: 255 }) >=
            contrastRatio(rgb, { b: 0, g: 0, r: 0 })
              ? '#ffffff'
              : '#000000';

          return (
            <button
              aria-label={`Copy ${family.name}-${step} ${color}`}
              data-palette-token={`${family.name}-${step}`}
              key={step}
              style={{ background: color, color: foreground }}
              type="button"
              onClick={() => void onCopy(color)}
            >
              <span>{step}</span>
              <code>{color}</code>
            </button>
          );
        })}
      </div>
      <p>
        {white.toFixed(2)}:1 on white · normal text AA {white >= 4.5 ? 'pass' : 'fail'}
        {` · APCA Lc ${apcaWhite}`}
        <br />
        {black.toFixed(2)}:1 on black · normal text AA {black >= 4.5 ? 'pass' : 'fail'}
        {` · APCA Lc ${apcaBlack}`}
      </p>
    </section>
  );
}

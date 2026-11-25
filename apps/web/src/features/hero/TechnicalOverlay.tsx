import styles from './TechnicalOverlay.module.scss';

type PlusMarkerPosition = 'left' | 'right-bottom' | 'right-top';

interface PlusMarkerProps {
  position: PlusMarkerPosition;
}

const plusMarkerClasses: Record<PlusMarkerPosition, string | undefined> = {
  left: styles.technicalSymbolPlusLeft,
  'right-bottom': styles.technicalSymbolPlusRightBottom,
  'right-top': styles.technicalSymbolPlusRightTop,
};

const PLUS_MARKER_POSITIONS: PlusMarkerPosition[] = ['left', 'right-top', 'right-bottom'];

const MEMORY_DUMP = '0x3A  0xF2  0x7B\n0x9C  0x11  0x4D\n0xE8  0x6A  0x93';

const WAVEFORM_PATH = 'M2 22 Q 14 6, 26 22 T 50 22 T 74 22 T 94 22';

function PlusMarker({ position }: PlusMarkerProps) {
  return (
    <svg
      className={`${styles.technicalSymbol} ${styles.technicalSymbolPlus} ${plusMarkerClasses[position]}`}
      fill="none"
      viewBox="0 0 12 12"
    >
      <path className={styles.overlayLines} d="M6 1v10M1 6h10" />
    </svg>
  );
}

function ConnectorSchematic() {
  return (
    <svg
      className={`${styles.technicalSymbol} ${styles.technicalSymbolConnector}`}
      fill="none"
      viewBox="0 0 104 70"
    >
      <line className={styles.overlayLines} strokeDasharray="4 3" x1="26" x2="90" y1="14" y2="14" />
      <line className={styles.overlayLines} x1="90" x2="80" y1="14" y2="56" />
      <line className={styles.overlayLines} x1="80" x2="14" y1="56" y2="46" />
      <line className={styles.overlayLines} strokeDasharray="3 3" x1="14" x2="26" y1="46" y2="14" />
      <line
        className={styles.overlayLines}
        opacity="0.5"
        strokeDasharray="2 3"
        x1="26"
        x2="80"
        y1="14"
        y2="56"
      />
      <rect className={styles.overlayNode} height="6" width="6" x="23" y="11" />
      <circle className={styles.overlayPoints} cx="90" cy="14" r="3" />
      <rect className={styles.overlayNode} height="6" width="6" x="77" y="53" />
      <circle className={styles.overlayPoints} cx="14" cy="46" r="3" />
      <circle className={styles.overlayDot} cx="53" cy="35" r="2" />
    </svg>
  );
}

function TargetReticle() {
  return (
    <svg
      className={`${styles.technicalSymbol} ${styles.technicalSymbolReticle}`}
      fill="none"
      viewBox="0 0 56 56"
    >
      <circle className={styles.overlayLines} cx="28" cy="28" r="24" strokeDasharray="4 2" />
      <circle className={styles.overlayLines} cx="28" cy="28" r="12" />
      <circle className={styles.overlayPoints} cx="28" cy="28" r="2" />
      <line className={styles.overlayLines} x1="4" x2="16" y1="28" y2="28" />
      <line className={styles.overlayLines} x1="40" x2="52" y1="28" y2="28" />
      <line className={styles.overlayLines} x1="28" x2="28" y1="4" y2="16" />
      <line className={styles.overlayLines} x1="28" x2="28" y1="40" y2="52" />
      <path className={styles.overlayLines} d="M12 8h-4v4" />
      <path className={styles.overlayLines} d="M44 8h4v4" />
      <path className={styles.overlayLines} d="M8 44v4h4" />
      <path className={styles.overlayLines} d="M48 44v4h-4" />
    </svg>
  );
}

function NetworkDiagram() {
  return (
    <svg
      className={`${styles.technicalSymbol} ${styles.technicalSymbolNetwork}`}
      fill="none"
      viewBox="0 0 84 75"
    >
      <line className={styles.overlayLines} x1="14" x2="66" y1="42" y2="16" />
      <line className={styles.overlayLines} x1="14" x2="72" y1="42" y2="38" />
      <line className={styles.overlayLines} x1="14" x2="36" y1="42" y2="60" />
      <line className={styles.overlayLines} strokeDasharray="3 2" x1="36" x2="68" y1="60" y2="60" />
      <polygon className={styles.overlayPoints} points="66,16 61,19 62,23" />
      <polygon className={styles.overlayPoints} points="72,38 67,36 67,41" />
      <circle className={styles.overlayNode} cx="14" cy="42" r="3.5" />
      <circle className={styles.overlayPoints} cx="66" cy="16" r="2.5" />
      <circle className={styles.overlayDot} cx="72" cy="38" r="2" />
      <circle className={styles.overlayPoints} cx="36" cy="60" r="2.5" />
      <rect className={styles.overlayNode} height="6" width="6" x="68" y="57" />
    </svg>
  );
}

function MemoryReadout() {
  return (
    <div className={`${styles.technicalReadout} ${styles.technicalReadoutLeft}`}>
      <span className={styles.technicalDotGrid} />
      <pre className={styles.sampleMatrix}>{MEMORY_DUMP}</pre>
    </div>
  );
}

function WaveformReadout() {
  return (
    <div className={`${styles.technicalReadout} ${styles.technicalReadoutRight}`}>
      <span className={`${styles.fieldEquation} ${styles.fieldEquationSide}`}>f(ω)</span>
      <svg
        className={styles.technicalWaveform}
        fill="none"
        preserveAspectRatio="none"
        viewBox="0 0 100 44"
      >
        <line
          className={styles.overlayLines}
          opacity="0.4"
          strokeDasharray="2 2"
          x1="0"
          x2="94"
          y1="22"
          y2="22"
        />
        <path className={styles.overlayLines} d="M90 19L96 22L90 25" fill="none" />
        <path className={styles.technicalWaveformBase} d={WAVEFORM_PATH} />
        <path className={styles.technicalWaveformPulse} d={WAVEFORM_PATH} />
        <circle className={styles.overlayPoints} cx="26" cy="22" r="2" />
        <circle className={styles.overlayPoints} cx="74" cy="22" r="2" />
      </svg>
      <span className={styles.technicalDotGrid} />
    </div>
  );
}

export function TechnicalOverlay() {
  return (
    <div aria-hidden="true" className={styles.technicalOverlay} data-testid="technical-overlay">
      {PLUS_MARKER_POSITIONS.map((position) => (
        <PlusMarker key={position} position={position} />
      ))}

      <ConnectorSchematic />

      <span className={styles.technicalBraces}>&#123; &#125;</span>

      <TargetReticle />

      <NetworkDiagram />

      <MemoryReadout />

      <WaveformReadout />
    </div>
  );
}

import styles from './HeroTriangle.module.scss';

export function HeroTriangle() {
  return (
    <svg
      aria-hidden="true"
      className={`${styles.heroTriangle} hero-triangle`}
      fill="none"
      focusable="false"
      viewBox="0 0 440 420"
    >
      <defs>
        <radialGradient id="hero-star-glow">
          <stop offset="0%" stopColor="#d9efff" stopOpacity="0.95" />
          <stop offset="22%" stopColor="#7cc4ff" stopOpacity="0.5" />
          <stop offset="60%" stopColor="#36b7ff" stopOpacity="0.12" />
          <stop offset="100%" stopColor="#36b7ff" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="hero-star-glow-light">
          <stop offset="0%" stopColor="#00639a" stopOpacity="0.8" />
          <stop offset="22%" stopColor="#36b7ff" stopOpacity="0.35" />
          <stop offset="60%" stopColor="#00639a" stopOpacity="0.08" />
          <stop offset="100%" stopColor="#00639a" stopOpacity="0" />
        </radialGradient>
      </defs>

      <path
        className={`${styles.heroTriangleLine} ${styles.heroTriangleAxis}`}
        d="M300 0V312"
        pathLength="1"
      />
      <path className={styles.heroTriangleLine} d="M360 240L300 62" pathLength="1" />
      <path className={styles.heroTriangleLine} d="M360 240L182 344" pathLength="1" />
      <path className={styles.heroTriangleLine} d="M300 62L182 344" pathLength="1" />
      <path
        className={`${styles.heroTriangleLine} ${styles.heroTriangleTail}`}
        d="M360 240L440 332"
        pathLength="1"
      />

      <g className={styles.heroTriangleStar}>
        <circle
          className={styles.heroTriangleStarGlowDark}
          cx="360"
          cy="240"
          fill="url(#hero-star-glow)"
          r="46"
        />
        <circle
          className={styles.heroTriangleStarGlowLight}
          cx="360"
          cy="240"
          fill="url(#hero-star-glow-light)"
          r="46"
        />
        <path className={styles.heroTriangleFlare} d="M322 240h76M360 202v76" />
        <circle className={styles.heroTriangleStarDot} cx="360" cy="240" r="2.4" />
      </g>
    </svg>
  );
}

import { LockKeyhole } from 'lucide-react';
import styles from './PrivacyStrip.module.scss';

export function PrivacyStrip() {
  return (
    <section className={styles.privacySection}>
      <div className="page-frame">
        <div className={styles.privacyStrip}>
          <span aria-hidden="true" className={styles.privacyIconBadge}>
            <LockKeyhole size={18} strokeWidth={1.7} />
          </span>
          <p>
            <strong>100% private by design.</strong> Everything runs on your machine. Your data
            never leaves your device.
          </p>
          <span className={styles.privacyGuarantee}>No tracking. No accounts. No uploads.</span>
        </div>
      </div>
    </section>
  );
}

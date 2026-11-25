import { Info, Layout, type LucideIcon, Palette, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import {
  customColorMode,
  type DesktopSettings,
  type DesktopThemeMode,
  type DesktopThemePresetId,
  parseHex,
} from '../../utils/desktopSettings';
import { AboutPanel, AppearancePanel, SidebarPanel } from './DesktopSettingsPanels';
import { selectWithArrowKeys } from './selectWithArrowKeys';
import styles from './DesktopSettingsModal.module.scss';

interface DesktopSettingsModalProps {
  isOpen: boolean;
  settings: DesktopSettings;
  onClearRecent(): void;
  onClose(): void;
  onResetAppearance(): void;
  onUpdateSetting<K extends keyof DesktopSettings>(key: K, value: DesktopSettings[K]): void;
}

type SettingsTab = 'appearance' | 'sidebar' | 'about';

interface SettingsTabItem {
  icon: LucideIcon;
  id: SettingsTab;
  label: string;
}

interface SettingsNavProps {
  activeTab: SettingsTab;
  onTabChange(tab: SettingsTab): void;
}

const SETTINGS_TABS: SettingsTabItem[] = [
  { icon: Palette, id: 'appearance', label: 'Appearance' },
  { icon: Layout, id: 'sidebar', label: 'Sidebar' },
  { icon: Info, id: 'about', label: 'About' },
];

const SETTINGS_TAB_IDS = SETTINGS_TABS.map(({ id }) => id);
const SETTINGS_PANEL_ID = 'settings-panel';

const settingsTabId = (tab: SettingsTab) => `settings-tab-${tab}`;

const settingsTabTitles: Record<SettingsTab, string> = {
  about: 'About Dev Toolora',
  appearance: 'Appearance',
  sidebar: 'Sidebar',
};

function SettingsNav({ activeTab, onTabChange }: SettingsNavProps) {
  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) =>
    selectWithArrowKeys(event, SETTINGS_TAB_IDS, activeTab, onTabChange);

  return (
    <div
      aria-label="Settings sections"
      aria-orientation="vertical"
      className={styles.sidebar}
      role="tablist"
      onKeyDown={handleKeyDown}
    >
      <span aria-hidden="true" className={styles.sidebarHeader}>
        Settings
      </span>
      {SETTINGS_TABS.map(({ icon: Icon, id, label }) => (
        <button
          aria-controls={SETTINGS_PANEL_ID}
          aria-selected={activeTab === id}
          className={styles.tabButton}
          id={settingsTabId(id)}
          key={id}
          role="tab"
          tabIndex={activeTab === id ? 0 : -1}
          type="button"
          onClick={() => onTabChange(id)}
        >
          <Icon aria-hidden="true" size={16} />
          <span>{label}</span>
        </button>
      ))}
    </div>
  );
}

interface SettingsHeaderProps {
  activeTab: SettingsTab;
  onClose(): void;
}

function SettingsHeader({ activeTab, onClose }: SettingsHeaderProps) {
  return (
    <header className={styles.header}>
      <h2 id="settings-dialog-title">{settingsTabTitles[activeTab]}</h2>
      <button
        aria-label="Close settings"
        className={styles.closeButton}
        type="button"
        onClick={onClose}
      >
        <X aria-hidden="true" size={16} />
      </button>
    </header>
  );
}

interface SettingsLayoutProps {
  activeTab: SettingsTab;
  children: React.ReactNode;
  onClose(): void;
  onTabChange(tab: SettingsTab): void;
}

function SettingsLayout({ activeTab, children, onClose, onTabChange }: SettingsLayoutProps) {
  return (
    <>
      <SettingsNav activeTab={activeTab} onTabChange={onTabChange} />

      <div className={styles.contentWrapper}>
        <SettingsHeader activeTab={activeTab} onClose={onClose} />

        <div
          aria-labelledby={settingsTabId(activeTab)}
          className={styles.body}
          id={SETTINGS_PANEL_ID}
          role="tabpanel"
          tabIndex={0}
        >
          {children}
        </div>
      </div>
    </>
  );
}

type UpdateSetting = DesktopSettingsModalProps['onUpdateSetting'];

function useSettingsTab() {
  const [activeTab, setActiveTab] = useState<SettingsTab>('appearance');

  const handleTabChange = (tab: SettingsTab) => {
    setActiveTab(tab);
  };

  return { activeTab, handleTabChange };
}

// showModal() makes the page inert, closes on Escape and restores focus after close().
function useModalDialog(isOpen: boolean, onClose: () => void) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;

    if (!dialog) return;

    if (isOpen && !dialog.open) {
      dialog.showModal();
      dialog.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]')?.focus();
    }

    if (!isOpen && dialog.open) dialog.close();
  }, [isOpen]);

  // A text selection dragged out of the panel ends with a click on the backdrop; only a press
  // that also started there closes the dialog.
  const pressTarget = useRef<EventTarget | null>(null);

  const handleBackdropPointerDown = (event: React.PointerEvent<HTMLDialogElement>) => {
    pressTarget.current = event.target;
  };

  const handleBackdropClick = (event: React.MouseEvent<HTMLDialogElement>) => {
    if (event.target === event.currentTarget && pressTarget.current === event.currentTarget)
      onClose();
  };

  return { dialogRef, handleBackdropClick, handleBackdropPointerDown };
}

function useCustomColorInput(settings: DesktopSettings, updateSetting: UpdateSetting) {
  const [invalidHexDraft, setInvalidHexDraft] = useState<string | null>(null);

  const handleCustomColorChange = (hex: string) => {
    if (!parseHex(hex)) {
      setInvalidHexDraft(hex);

      return;
    }

    setInvalidHexDraft(null);
    updateSetting('presetId', 'custom');
    updateSetting('customBgColor', hex.startsWith('#') ? hex : `#${hex}`);
    updateSetting('themeMode', customColorMode(hex));
  };

  const handleCustomColorBlur = () => setInvalidHexDraft(null);

  return {
    customHexInput: invalidHexDraft ?? settings.customBgColor ?? '',
    handleCustomColorBlur,
    handleCustomColorChange,
  };
}

function useRecentClearFeedback(onClearRecent: () => void) {
  const [clearedRecentFeedback, setClearedRecentFeedback] = useState(false);

  const handleClearRecent = () => {
    onClearRecent();
    setClearedRecentFeedback(true);
    setTimeout(() => setClearedRecentFeedback(false), 2000);
  };

  return { clearedRecentFeedback, handleClearRecent };
}

function useSettingUpdaters(updateSetting: UpdateSetting) {
  const handleThemeModeChange = (mode: DesktopThemeMode) => {
    updateSetting('themeMode', mode);
  };

  const handlePresetSelect = (presetId: DesktopThemePresetId) => {
    updateSetting('presetId', presetId);
    updateSetting('customBgColor', null);
  };

  const handleShowRecentChange = (showRecent: boolean) => {
    updateSetting('showRecent', showRecent);
  };

  return { handlePresetSelect, handleShowRecentChange, handleThemeModeChange };
}

export function DesktopSettingsModal({
  isOpen,
  settings,
  onClearRecent,
  onClose,
  onResetAppearance,
  onUpdateSetting,
}: DesktopSettingsModalProps) {
  const { activeTab, handleTabChange } = useSettingsTab();
  const customColor = useCustomColorInput(settings, onUpdateSetting);
  const { clearedRecentFeedback, handleClearRecent } = useRecentClearFeedback(onClearRecent);
  const { handlePresetSelect, handleShowRecentChange, handleThemeModeChange } =
    useSettingUpdaters(onUpdateSetting);
  const { dialogRef, handleBackdropClick, handleBackdropPointerDown } = useModalDialog(
    isOpen,
    onClose,
  );

  return (
    <dialog
      aria-labelledby="settings-dialog-title"
      className={styles.modal}
      ref={dialogRef}
      onClick={handleBackdropClick}
      onClose={onClose}
      onPointerDown={handleBackdropPointerDown}
    >
      {isOpen && (
        <SettingsLayout activeTab={activeTab} onClose={onClose} onTabChange={handleTabChange}>
          {activeTab === 'appearance' && (
            <AppearancePanel
              customHexInput={customColor.customHexInput}
              settings={settings}
              onCustomColorBlur={customColor.handleCustomColorBlur}
              onCustomColorChange={customColor.handleCustomColorChange}
              onPresetSelect={handlePresetSelect}
              onReset={onResetAppearance}
              onThemeModeChange={handleThemeModeChange}
            />
          )}

          {activeTab === 'sidebar' && (
            <SidebarPanel
              isRecentCleared={clearedRecentFeedback}
              showRecent={settings.showRecent}
              onRecentClear={handleClearRecent}
              onShowRecentChange={handleShowRecentChange}
            />
          )}

          {activeTab === 'about' && <AboutPanel />}
        </SettingsLayout>
      )}
    </dialog>
  );
}

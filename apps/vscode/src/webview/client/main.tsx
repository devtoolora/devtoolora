import './styles/theme.css';
import { loadWorkerHost } from './host/createWebviewWorker';
import { readToolData, readWebviewConfig } from './utils/toolData';

const config = readWebviewConfig();
const root = document.getElementById('appRoot');

if (!root) throw new Error('Missing webview root: appRoot');

document.body.dataset.mode = config.mode ?? 'sidebar';

async function startEditor(container: HTMLElement): Promise<void> {
  // Import the file, not the barrel: vite.config.ts names the chunk after the EditorApp module.
  const [{ mountEditorApp }, host] = await Promise.all([
    import('./views/editor-app/EditorApp'),
    loadWorkerHost(config.workerUri),
  ]);

  mountEditorApp(container, {
    config,
    host,
    tools: readToolData(),
  });
}

async function startSidebar(container: HTMLElement): Promise<void> {
  // Import the file, not the barrel: vite.config.ts names the chunk after the SidebarApp module.
  const { mountSidebarApp } = await import('./views/sidebar-app/SidebarApp');

  mountSidebarApp(container, {
    config,
    tools: readToolData(),
  });
}

void (config.mode === 'editor' ? startEditor(root) : startSidebar(root));

# Apps

App surfaces live here:

- `web` owns the public React Router site, browser worker, and the desktop
  shell. The tool-runner UI itself lives in `@devtoolora/tool-ui`.
- `vscode` owns the complete VS Code-compatible extension package, including
  its manifest, webview, assets, tests, and VSIX build. Both webviews are
  React: the editor is the shared runner from `@devtoolora/tool-ui` inside
  a VS Code shell (`src/webview/client/views/editor-app/EditorApp.tsx`), the sidebar is a
  catalog without the runner (`src/webview/client/views/sidebar-app/SidebarApp.tsx`). See
  `docs/adr/0001-one-react-runner-for-all-surfaces.md`.
- `desktop` contains the Tauri shell for the cross-platform desktop native app.

Current shared contracts:

- `@devtoolora/core` owns tool types, registry validation, capability
  metadata, serializable tool metadata, and capability-gated execution.
- `@devtoolora/tools` is the single source of truth for tool
  implementations used by web/PWA, VS Code, and the native app.
- `@devtoolora/browser-catalog` is the audited browser-safe runtime used
  by the web worker and VS Code webview.

Apps do not import one another's internal source. Shared behavior belongs in a
package only when more than one app consumes it.

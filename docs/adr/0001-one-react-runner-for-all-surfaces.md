# ADR 0001: One React tool-runner for web, desktop and the VS Code webview

**Status:** Accepted, 2026-10-17.

## Context

The web app and the desktop shell rendered tools with a React runner in `apps/web`; the VS Code webview rendered the same `ToolResult` contract with a ~4,700-line vanilla TypeScript client. The two implementations were already drifting (field visibility rules differed), and every visual preview (JSON tree, text diff, image crop, CSS workspace) existed twice.

## Decision

- The runner lives once in `packages/tool-ui` (`@devtoolora/tool-ui`), consumed from source through the root `tsconfig.json` paths by `apps/web` and `apps/vscode`.
- Hosts adapt through `ToolRunnerHost` (worker creation, `getTool` per tool) and `ToolPlatformActions`; VS Code keeps only its shell concerns in `apps/vscode/src/webview/client` (drafts, "Continue with" handoff, split pane, line gutters, help tabs, sidebar catalog).
- Both VS Code webviews are React. The vanilla client, its CSS and its jsdom DOM tests are deleted; behaviour is covered by jsdom component tests (`apps/vscode/test/webview`) and role-based Playwright specs under the production CSP.

## Consequences

- React ships inside the VSIX: the entry `main.js` stays React-free and reaches `app.js` / `sidebarApp.js` through dynamic imports; the shared React chunk is emitted next to them. VSIX grew from 1.8 MB to 2.8 MB (limit 12 MiB).
- The webview CSP forbids inline styles and remote fonts, so the shared runner must stay CSP-safe (constructable stylesheets instead of `<style>`, blob workers, SCSS modules only). `apps/vscode/test/extension.test.ts` gates every built CSS asset and `index.html`.
- Theming maps `--vscode-*` variables onto the tool-ui token contract in `styles/theme.css`; `color-scheme` follows the theme-kind classes the host puts on `body` (`vscode-light`, `vscode-dark`, …), so native controls match the theme, not the OS.
- `useToolRunner` keeps one worker per mounted runner: switching tools only sends `getTool`; a new worker is created after a crash or on Retry (2026-10-18). Trade-off: a non-isolated run longer than the 10 s definition timeout followed by a tool switch ends in the "worker did not start in time" error with Retry, because the shared worker is busy (the heavy tools are `isolatedWorker`).

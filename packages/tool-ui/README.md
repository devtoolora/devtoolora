# @devtoolora/tool-ui

The React tool-runner and the UI primitives it uses, shared by the web site, the desktop shell and the VS Code webview. The package is consumed from source through the root `tsconfig.json` paths; it has no build step and no `dist`.

## What a host must provide

- A `ToolRunnerHost` with `createWorker()` returning a worker that speaks the `getTool` / `runTool` protocol (`listTools` stays available for catalog consumers; see `apps/web/src/worker.ts`). `createWorker` is synchronous: a host whose worker script must be fetched first (the VS Code webview, whose CSP allows only `blob:` workers) fetches it before mounting and hands out `new Worker(blobUrl)`.
- Optional `ToolPlatformActions` for native save and clipboard, plus an optional `pickFiles`. Without `pickFiles` the file field falls back to the browser's `<input type="file">`; without any actions the runner falls back to browser APIs.
- The CSS token contract below on `:root`.

## Composing your own layout

`ToolWorkspace` is the ready-made web layout. A host that owns its own chrome (the VS Code editor webview) uses the same state through `useToolWorkspace({ host, metadataId, initialInput, platformActions, onInputsChange })` and renders `ToolInputPanel` and `ToolOutputPanel` itself:

- `initialInput` is a `ToolInputSeed` (`{ key, text?, fields? }`): a new `key` applies the seed again, the same key keeps what the user typed. Hosts use it for restored drafts and for text handed over by the editor.
- `onInputsChange(text, fields)` fires on every change so the host can persist drafts.
- Put `onKeyDown={workspace.handleKeyDown}` on the layout root: Cmd/Ctrl+Enter runs the tool only from inside it.
- `ToolInputPanel` slots: `notice` (top of the body), `inputGutter` (before the textarea) and `textareaRef`. `ToolOutputPanel` slots: `actions` (after Copy and Save), `footer` (end of the body), `outputGutter` and `outputRef`; the output slots render only with a fresh result.
- `density="compact"` on both panels gives the editor layout: smaller controls, a one-line heading and short fields that share rows as far as the panel's width allows.
- The pdf.js preview worker is fetched and started from a `blob:` URL, so every host CSP must allow `worker-src blob:`.

## CSS token contract

Colors: `--color-void`, `--color-surface`, `--color-surface-strong`, `--color-line`, `--color-line-soft`, `--color-text`, `--color-muted`, `--color-signal`, `--color-signal-soft`, `--color-calibration`, `--color-shadow`.

Fonts: `--font-display`, `--font-mono`, `--font-size-3xs`, `--font-size-2xs`, `--font-size-xs`, `--font-size-sm`, `--font-size-md`, `--font-size-base`, `--font-size-lg`, `--font-size-xl`.

Optional: `--color-action` and `--color-on-action` color the Run button (default `--color-signal` and `--color-void`).

The runner never loads fonts. Panel text, controls and previews take their colors from these tokens, which a host maps from its own theme (the web `base.css`, or `--vscode-*` variables). One gap remains: the workspace frame background is dark unless the host sets `data-theme="light"` on `<html>`. A host with its own light theme must set that attribute until the background moves to a token (planned with the VS Code webview work).

## Stable class hooks

Browser tests select on these plain classes. Keep them on the same elements when changing markup: `.tool-workspace`, `.workspace-panel`, `.input-panel`, `.output-panel`, `.panel-body`, `.primary-input`, `.selected-file-name`, `.run-tool-button`, `.tool-checkbox`, `.tool-segmented-control`, `.tool-range-field`, `.batch-result`, `.sample-select`, `.result-summary`.

## Rules

- No imports from `react-router`, an app's `@components` or `@styles` aliases, `@tauri-apps/*`, or Vite `?worker` URLs. `tests/release/toolUiBoundaries.test.ts` enforces this.
- No DOM access at module scope: the web build prerenders every route and imports these modules at build time.
- No inline `<style>` elements: the VS Code webview CSP blocks them. Use CSSOM (`adoptedStyleSheets`) or inline `style` props.

# Packages

Shared workspace packages live here.

- `@devtoolora/core` defines portable tool contracts, registry validation,
  capability helpers, and metadata serialization.
- `@devtoolora/tools` owns tool implementations for all app surfaces,
  with one shared implementation per tool.
- `@devtoolora/browser-catalog` assembles the audited browser-worker tool
  slice used by the PWA shell.
- `@devtoolora/tool-ui` holds the React tool-runner and UI primitives
  shared by web, desktop and VS Code. It is consumed from source through the
  root `tsconfig.json` paths.

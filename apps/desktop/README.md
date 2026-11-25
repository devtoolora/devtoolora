# Desktop

Cross-platform Tauri shell for the Dev Toolora desktop workspace.

- `npm run desktop:dev` starts the React Router dev server and opens Tauri.
- `npm run desktop:build` creates the unsigned platform bundle.
- `npm run desktop:smoke` verifies the web artifact, route isolation, permissions,
  icons, CSP, and Rust project when Cargo is available.

On headless macOS runners, use `CI=true npm run desktop:build -- -- --no-sign`
to skip Finder-only DMG decoration.

The window loads the prerendered `/desktop` route from `out/web`. It reuses the
metadata, schema-driven workspace, Web Worker and browser-safe tools of the
public web app. Only the desktop route imports Tauri APIs.

On macOS the window is created transparent (`tauri.macos.conf.json`) so the Liquid Glass theme can
show the desktop through it. That needs `macOSPrivateApi`, which the Mac App Store does not accept.
Windows and Linux keep an opaque window and draw the glass inside the app.

Dialog-selected files are read through the scoped filesystem plugin, and save
and clipboard actions use their native plugins with browser fallbacks. The app
stores only theme, favorites, up to eight recent tool IDs, and window state. It
does not register the public service worker or persist tool input and file paths.

# Dev Toolora

More than 250 developer tools that run on your computer, on the web and in VS Code, Cursor,
Antigravity and other VS Code-compatible editors. Format and validate JSON, YAML and XML, encode and
decode Base64, URLs and JWTs, inspect certificates and keys, generate UUIDs, hashes and passwords,
convert timestamps and units, edit PDFs and images, and more.

Nothing you paste, select or open is sent anywhere. There are no accounts and no cookies. The VS
Code extension collects no data at all. The website counts anonymous page views with Cloudflare Web
Analytics, without cookies and without anything you type. The web version works offline after the
first visit. HEIC conversion and image OCR download their engine the first time you use them online.

## Where it runs

| Surface | Source | Notes |
| --- | --- | --- |
| Web | `apps/web` | React Router app prerendered to `out/web`, installable as a PWA. |
| VS Code extension | `apps/vscode` | Activity Bar catalog, selection commands and an editor webview. |

## Tool categories

Formatters, Encoders, Web/API, Text, Crypto, Dev Utilities, Date & Time, Images & Codes, Network,
Math, Data, Measurement, Config & Secrets, Logs & Diagnostics, CSS & Design, Schema & Types, AI &
Prompts, and Documents & PDF. The full list with samples and documentation is in the catalog at
`/tools`.

## Development

```bash
npm install
npm run dev:web         # web app on http://localhost:5173
npm test                # unit tests
npm run test:browser    # browser tests (builds web and webview first)
npm run verify          # format, lint, unit tests and a VSIX check
npm run package         # VSIX for every platform
npm run licenses        # regenerate THIRD_PARTY_LICENSES.md
```

## Workspace architecture

The repository root is a private npm workspace orchestrator. Typed operations live by domain in
`packages/functions`; shared tool contracts live in `packages/core`; `packages/tools` adds tool
metadata, field parsing and result presentation; `packages/tool-ui` is the shared React tool runner;
and `packages/browser-catalog` is the audited browser-worker boundary. Product manifests, builds,
assets and tests belong to `apps/web` and `apps/vscode`.

The React Router build in `apps/web` also contains the `/desktop` workspace route for the upcoming
desktop app, which lives on the `feature/native-app` branch until it ships. Web deployment files
are written to `out/web` and VS Code bundles to `apps/vscode/dist`.

## CI artifacts

Pull requests and pushes to `main` run the unit, browser and package checks. Successful runs provide
the web build and one VSIX package for every platform as GitHub Actions artifacts.

To release, set the same version in `package.json` and `apps/vscode/package.json`, add its section
to `CHANGELOG.md` and push a `vX.Y.Z` tag. CI then creates a draft GitHub release with the VSIX
package and the web build. Publishing it and the Marketplace and Open VSX uploads stay manual.

## Privacy

Every tool runs in the browser or the extension webview. Selected text, secrets and file contents
are not sent to any service. File and batch tools create new files or archives and never change the
originals.

## License

MIT. Third-party licenses are listed in [THIRD_PARTY_LICENSES.md](THIRD_PARTY_LICENSES.md) and the
release notes in [CHANGELOG.md](CHANGELOG.md).

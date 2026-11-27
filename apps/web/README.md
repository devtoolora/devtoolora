# Web

Dev Toolora is a statically prerendered React Router application. It exposes
the homepage, complete tool catalog, one stable route for every generated tool,
and public Extension and About pages. The final deployable artifact is
always written to `out/web`.

## Commands

- `npm run dev:web` starts framework development on port 5173.
- `npm run typecheck:web` generates route types and checks the web app.
- `npm run build:web` prerenders the application into `out/web`.
- `npm run preview:web` serves the final artifact on port 4173.
- `npm run lighthouse` audits the built site (run `npm run build:web` first) and writes
  `out/lighthouse/summary.json`; it exits 1 while any median is below 100, which is
  expected for mobile performance (currently 91-98 by decision).
- `npm run test:browser` builds and exercises the web and worker flows.

## Architecture

Route modules are the lazy-loading boundaries. The root owns the document,
theme bootstrap, and service-worker registration. Generated metadata powers
search, catalog cards, SEO, and static tool routes without importing executable
tools into the page bundle.

Tool execution begins only on a detail route. The detail workspace creates a
module worker, requests the one serialized definition with `getTool`, and executes
the selected tool with `runTool`. Request IDs discard stale responses, and the
worker is terminated on retry or unmount. Inputs are not persisted or sent to a
server.

The generic runner supports text, textarea, password, number, checkbox, file,
select, searchable select, and checkbox-group fields. It renders text, JSON or
Markdown source, previews, summaries, artifacts, and batch results. Complex
tools use a small web-local visibility helper; specialized editor controls stay
outside the web app.

The `/desktop` route intentionally lives in this app so the public detail pages
and Tauri workspace share one schema runner and worker. Only that lazy route
imports Tauri JavaScript APIs; the native container lives on the `feature/native-app` branch.

## Static deployment and SEO

Set `SITE_URL` to an HTTP(S) production origin when building to emit canonical
URLs and `sitemap.xml`. Local builds intentionally omit both. Static hosting
must serve files from `out/web` and use `__spa-fallback.html` for unmatched
client navigations. The service worker precaches the shared shell and worker,
then runtime-caches visited tool pages and optional FIGlet fonts.

Worker guide data is losslessly compressed at build time and decoded locally,
so a cold offline worker does not need to import a separate documentation
chunk. The default Standard FIGlet font is also embedded in compressed form;
other fonts remain on-demand assets. Compression uses the existing `fflate`
runtime, and build-time evaluation is limited to repository guide data modules
without runtime imports. User-provided tool inputs are never evaluated this way.

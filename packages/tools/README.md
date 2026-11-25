# Tool adapters

`@devtoolora/tools` owns Dev Toolora's complete `ToolDefinition` catalog. A tool adapter describes fields, samples, help, capabilities, and result actions; it parses UI strings, calls a typed operation from `@devtoolora/functions`, and formats the returned value as a `ToolResult`.

Reusable algorithms do not belong here. Add or change the operation in the appropriate functions domain first, then keep the tool adapter focused on representation and presentation. Raw serialized file fields are decoded only by `src/adapters/files.ts`, and expected `FunctionError` values are translated by `src/adapters/errors.ts`.

The browser catalog consumes these complete definitions and exposes the `getTool`/`listTools`/`runTool` worker protocol to web, VS Code, and desktop.

## Adding a tool

1. Add the operation to `packages/functions/src/<domain>/`, export it from the domain index, and cover it in `packages/functions/test/`.
2. Create `src/catalog/<domain>/<id>/` with `tool.ts` (the `ToolDefinition`) and `content.ts` (exports `content`). Copy `src/catalog/text/text-reverser/` as a template. Required `ToolDefinition` fields: `category`, `description`, `id`, `inputKind`, `name`, `outputKind`, `run`, `supportsSelection`. Aliases (`aliasOf`) are declared in their canonical `tool.ts` and get no folder.
3. In `src/catalog/<domain>/index.ts` make three edits: the `import`, `export * from './<id>/tool'` (tests import the tool const from the domain index), and the array entry. The array position is the catalog order, so update the pinned snapshot in `packages/browser-catalog/test/catalogOrder.test.ts` on purpose. Helpers shared by a domain live in `shared.ts`.
4. Add `test/<id>.test.ts`. `packages/browser-catalog/test/toolGuides.test.ts` requires per canonical tool: at least 2 `documentation` sections, a `help` of at least 4 paragraphs (split by blank lines), at least 4 `examples`, at least 3 `notes`, at least 6 `samples`, at least 2 `relatedToolIds` (not the tool itself), and 3-6 unique `faq` entries whose question ends in `?` and whose answer is 20-420 characters. `catalogConventions.test.ts` also requires a non-empty `faq`.
5. Run `npm run generate` (`npm test`, `npm run typecheck` and builds run it for you). The `*.generated.*` files it writes (`content.generated.ts`, `toolDomains.generated.ts` and both `toolMetadata.generated.ts`) are gitignored; never commit them.
6. A new domain also needs its folder, a key in `domainTools` (`src/catalog/index.ts`), a loader in `lazy.ts` (typecheck reports the missing one), and, for functions, an export in `packages/functions/package.json`.

`test/catalogConventions.test.ts` enforces the layout and that referenced field ids exist.

### Self-describing UI

Declare behavior on the definition instead of branching on tool ids in UI code:

- `fields[].visibleWhen`: show a field only while other fields have (or lack) given values; `anyOf` nests alternatives.
- `fields[].required`: the field must be non-blank to run.
- `runRequires`: replaces the generic run check; each entry needs one non-blank `anyOf` member (`'$text'` is the main input), optionally only `when` a condition holds.
- `inputVisibleWhen`: hides the main text input unless the condition holds.
- `fileModeWhen`: marks Base64-style file in/out, which changes labels and output handling. The UI is not generic: the tool must declare the fields `file`, `fileName`, `fileOutput` and `mode` (see `base64-encode`).
- `preview`: a `ToolPreviewKind` for a live preview next to the result.
- `badge`: a `ToolBadge` shown on the tool.
- `selectionTarget`: the field (and preset `fields`) that editor-selected text seeds instead of the main input.

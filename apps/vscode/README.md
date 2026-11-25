# Dev Toolora for VS Code

More than 250 developer tools that run on your computer: format and validate JSON, YAML and XML,
encode and decode Base64, URLs and JWTs, generate UUIDs and hashes, convert timestamps, compare
text and much more. Select text, pick a tool and put the result back without leaving your file.

Nothing you paste, select or open is sent anywhere. The extension has no accounts, no analytics and
no telemetry, and it makes no network requests.

## Getting started

1. Open the Dev Toolora view in the Activity Bar and search for a tool.
2. Or select text, right-click and choose **Dev Toolora: Transform Selection...**.
3. Run the tool with the Run button or `Shift+Cmd+R` (`Shift+Ctrl+R` on Windows and Linux).
4. Replace the selection, insert at the cursor, copy, or open the result in a new editor.

## Commands

| Command | What it does |
| --- | --- |
| Dev Toolora: Transform Selection... | Pick a tool and load the selected text into it. |
| Dev Toolora: Suggest Tools for Selection | See which tools fit what you selected. |
| Dev Toolora: Run Tool... | Find a tool by name and open it. |
| Dev Toolora: Base64 Encode File | Encode a file from the Explorer. |
| Dev Toolora: Open Active Tool in Editor | Open the current tool in an editor tab. |

## Good to know

- The panel uses the colors of your VS Code theme and reflows as you resize it.
- Your input is restored when the panel reloads, and favorites stay in the sidebar.
- File tools save new copies and never change the files you opened.
- Works in VS Code 1.96 or newer and in compatible editors.

## License

MIT. Third-party licenses ship in `dist/THIRD_PARTY_LICENSES.md` inside the extension.

## Development

From the repository root:

- `npm run build:vscode` builds the metadata, the extension host and the webview.
- `npm run package:verify` builds and checks a temporary VSIX.
- `npm run package` creates `devtoolora.vsix`, one package for every platform.

The extension host bundle and webview are written to `apps/vscode/dist`. Portable tools live in
`@devtoolora/tools`; the webview runs the audited `@devtoolora/browser-catalog` in its
local worker.

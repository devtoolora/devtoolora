# Contributing to Dev Toolora

Bug reports, tool ideas and pull requests are welcome. Open an issue before starting a large change,
so we can agree on the approach first.

## Setup

You need Node.js 24 (see `.nvmrc`).

```bash
npm install
npm run dev:web         # web app on http://localhost:5173
```

To try the VS Code extension, run `npm run package` and install `devtoolora.vsix` with
`code --install-extension devtoolora.vsix`.

## Where things live

- `packages/functions`: the typed operations behind the tools, grouped by domain.
- `packages/tools/src/catalog/<group>/<tool-id>`: one folder per tool with its fields (`tool.ts`)
  and documentation (`content.ts`). A few tools also keep larger samples in `sample.ts`. Groups
  are folders such as `crypto`, `devUtilities` and `formatters`.
- `packages/tool-ui`: the shared React tool runner and design system.
- `apps/web`, `apps/vscode`: the web app and the VS Code extension, with their tests. The desktop
  app lives on the `feature/native-app` branch until it ships.

The README describes the architecture in more detail.

## Rules every tool follows

- Tools run on the user's device. A tool never sends input, files or results over the network.
- A tool never changes the user's original file; it creates a new file or archive.
- Ambiguous or out-of-range input gets a clear warning that says what the tool did with it.
- New dependencies need a license compatible with MIT. Run `npm run licenses` after adding one.

## Before you open a pull request

```bash
npm run typecheck
npm run verify          # format, lint, unit tests and a VSIX check
npm run knip            # unused files, exports and dependencies
npm run test:browser    # browser tests for the web app and the VS Code webview
```

Add or update tests for the behavior you change. Code style is checked by Prettier and ESLint, and
the coding conventions are described in [AGENTS.md](AGENTS.md).

Commit messages follow [Conventional Commits](https://www.conventionalcommits.org/), for example
`fix(tools): keep leading zeros in the CSV preview`. Keep each pull request to one topic.

## License

By contributing, you agree that your contribution is licensed under the [MIT License](LICENSE).

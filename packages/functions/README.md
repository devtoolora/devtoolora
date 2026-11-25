# Reusable functions

`@devtoolora/functions` contains the typed, UI-independent operations used by Dev Toolora tools. It targets the shared browser-worker runtime used by web, VS Code, and desktop. The package is private today, but its explicit domain exports and declarations keep it publication-ready.

Import the smallest domain you need:

```ts
import { rgbToHex } from '@devtoolora/functions/color';
import { hashText } from '@devtoolora/functions/crypto';
import { slugify } from '@devtoolora/functions/text';
```

Available domains are declared in `package.json`: binary, color, config, crypto, CSS, data, developer utilities, encoding, format, image, logs, math, measurement, network, PDF, QR, schema, SVG, text, web, validation, and errors. There is deliberately no package-root barrel.

Functions accept typed domain values and return typed values or bytes. Expected invalid input throws `FunctionError`, which provides a stable `code` and readable `message`. Functions never return `ToolResult` and never import application, worker, or tool contracts.

To add logic, place it beside its domain owner, export it from that domain's `index.ts`, add the package subpath only for a new domain, and test the function directly. Presentation metadata, raw form parsing, file-field serialization, artifact names, summaries, and `FunctionError` to `ToolError` translation belong in `@devtoolora/tools`.

The package stays private until its API surface has real external consumers and a versioning policy. Removing `private` alone is not a release process.

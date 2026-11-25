# Coding Rules & Architectural Guidelines

## Project Specific Adaptations

1. **Styling & Design System**:
   - Styling in `apps/web` uses **SCSS Modules** (`*.module.scss`) alongside global CSS design tokens defined in `apps/web/src/styles/base.css`.
   - Design system primitives (Button, Input, Accordion) live in `packages/tool-ui/src/ui` and are re-exported from `apps/web/src/components/ui`; app-only components stay in `apps/web/src/components`.
   - Design system variants:
     - Separate base classes from size and variant classes using typed record maps.
     - Components expose closed domain variants (`variant="primary"`, `size="sm"`), and own their internal styling.
     - Parents must not pass arbitrary `className` into children to control their internal state or look.

2. **TypeScript & Formatting**:
   - Always end statements with semicolons in `.ts`, `.tsx`, `.js`, and `.jsx` files.
   - Type/interface members and JSX props are sorted alphabetically, with `on*` callbacks/handlers last.
   - Strict equality (`===` and `!==`) everywhere; never loose equality (`==` or `!=`).
   - Use inline `&&` for presence checks rendering a single node to maintain TypeScript narrowing.

<!-- BEGIN:turborepo-agent-rules -->

# This is NOT the Turborepo you know

Turborepo configuration, task behavior, and CLI commands can vary between installed versions and may differ from your training data. Resolve the `turbo` package from this file's directory or relevant workspace; in monorepos, it may not be visible from the repository root. For example, run `node -p "require.resolve('turbo/package.json')"` from a workspace that depends on `turbo`.

Read `docs/README.md` inside that installed package first, then read the relevant pages from its `docs/` directory before changing Turborepo configuration or commands. Heed deprecation notices. These bundled docs match the installed package version and are available without network access.

This block is written and re-added by `turbo` before repository-scoped commands when an AI agent is detected. In the Turborepo source repository, its template is defined in `crates/turborepo-cli/src/cli/agent_guidance.rs`. Removing the managed block while updates are enabled means a later qualifying invocation will add it again. Set `"agentGuidance": false` in the root `turbo.json` or `turbo.jsonc` to opt out; this does not remove an existing block. Keep the block committed with your work to avoid an uncommitted change on the next agent invocation.
<!-- END:turborepo-agent-rules -->

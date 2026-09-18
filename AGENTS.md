# AGENTS.md

Tiny pointer for agents working in `solarisael`.

## Current source of truth

- Current continuity and project lessons live in Solarisael House/Postgres memory.
- Repo state and browser/runtime verification beat stale docs or old rule files.
- Local docs are evidence, not canon, unless they match current code and Sol's present intent.
- Historical context lives in `docs/history/`.

## Hard local facts

- Project root: `C:/Projects/solarisael`.
- Human/operator: Sol.
- Stack: Astro, native CSS, Bun, vanilla JavaScript, HTMX 2, and idiomorph.
- Use Bun only. Do not introduce npm, Yarn, or pnpm workflows.
- Markup intentionally uses ritual custom elements for structural shells.
- Naming stays snake_case; Sol-owned classes use `.sol__*`; Sol-owned ids use `#sol_*`.
- Functional/composition style is preferred. Do not introduce inheritance-shaped JS; existing class-based project code is cleanup debt, not precedent.

## HTMX/navigation facts

- The main route shell currently swaps `<container>`, not `body`.
- In `src/layouts/index.astro`, body owns the primary HTMX defaults.
- `data-phase` travels on `<container>`.
- HTMX script ordering is load-bearing: synchronous `htmx.min.js`, then synchronous `idiomorph-ext.js`, then the preload extension, before module app code.
- Local fragment swaps may use narrower targets; verify the current component before applying route-shell rules.

## Verification

- For HTMX, navigation, CSS, layout, visual, or interaction changes, verify in browser: route behavior, DOM state, console, and visible result.
- For library/API questions, use current documentation lookup before relying on memory.
- For build/package checks, use the project scripts in `package.json`.

## Docs posture

- `README.md`, `docs/progress.md`, `docs/roadmap.md`, and `docs/history/*` are human docs and may drift.
- FX docs and UI registries have known stale entries; verify against code before reusing values.
- Old `.opencode/rules/*` and `.opencode/agents/*` guidance was intentionally removed because it was stale and not actively used.

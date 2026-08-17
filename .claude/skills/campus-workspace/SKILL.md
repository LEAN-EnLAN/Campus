---
name: campus-workspace
description: Workspace shell invariants — panes, tabs, layout persistence, capability seams. Use when touching src/components/workspace/, src/lib/workspace/, or src/routes/_app/vault.tsx.
---

# Campus workspace

## Invariants that are TESTS, not conventions

- Presentation never imports `@/lib/vault` or `@/lib/backends/local`, never calls
  `useRuntime`, never branches on `mode === 'local'`. Enforced by
  `tests/unit/runtime-boundary.test.ts`. File surfaces ask `useFiles()` from
  `@/lib/files/context` — `null` means "no vault" (cloud), and every surface
  renders that state instead of crashing.
- Workspace layout (tabs, panes, sidebar) is DEVICE-local AND per-vault:
  `workspaceStorageKey(vaultPath)` in localStorage. It never goes inside the
  vault — a synced folder must not carry one machine's window arrangement.
- Max 2 panes (v1). The model (`src/lib/workspace/model.ts`) is a pure reducer;
  UI dispatches, never mutates.
- Explorer mutations flow through the workspace model too: `renamePath` so open
  tabs follow a renamed file, `closePath` so a trashed note closes everywhere.

## Responsive contract

≥1200 full workspace · 768–1199 collapsible sidebar, 1–2 panes · <768 single
active pane + sidebar as overlay sheet · 360px first-class. Never hide
functionality on mobile — adapt the interaction.

## Editor

CodeMirror 6, theme via CSS variables only (`editor-theme.ts`) — hardcoded
colors fork the design system. Autosave is debounced 800ms and rides
`writeNote(contents, knownMtime)`: a save can FAIL BY DESIGN (VAULT-003
conflict). States: Guardado / Sin guardar / Guardando… / Error / Cambió afuera.
Never save synchronously per keystroke; never silently discard a failed save;
external change with no local edits reloads, with local edits asks.

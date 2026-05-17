# Testing & Contributing

This page summarizes the verification standard for code and documentation changes.

## Source-of-Truth Files

- Renderer tests: `src/__tests__`, `src/composables/**/__tests__`, `src/utils/**/__tests__`, `src/validation/**/__tests__`
- Electron and DB tests: `electron/__tests__`
- Electron E2E tests: `e2e`
- Verification scripts: `package.json`

## Test Layers

### Renderer and State

Use Vitest for:

- store behavior
- composables
- utilities
- validation helpers

Renderer tests should mock `window.electronAPI` and return `IpcResult<T>` payloads instead of invoking real Electron runtime behavior.

### Electron and Database

Use the Electron-side tests for:

- schema initialization
- worker protocol behavior
- CRUD correctness
- reorder and transaction rollback behavior
- import/export and archive flows
- backup utility behavior

Database tests use in-memory SQLite rather than the real user database.

### Electron E2E

Use Playwright Electron tests for critical end-to-end workflows that need the renderer, preload bridge, main-process IPC, DB worker, SQLite, and filesystem behavior to work together.

The E2E suite runs through:

- collection, field, and item CRUD
- grid search, sort, inline edit, duplicate, bulk delete, and restart persistence
- collection CSV/JSON import and export
- full archive export and restore
- child view creation, rename, deletion, configuration, and restart persistence

E2E tests launch the built Electron app with `SECOND_BRAIN_E2E=1`. In that mode only:

- `SECOND_BRAIN_E2E_USER_DATA` overrides Electron `userData`, so tests use an isolated temporary database.
- `SECOND_BRAIN_E2E_DIALOG_RESULTS` provides deterministic save/open dialog results as FIFO queues, for example:

```json
{
  "save": ["C:/tmp/export.csv", "C:/tmp/archive.json"],
  "open": ["C:/tmp/import.csv", "C:/tmp/archive.json"]
}
```

Production launches do not use these hooks.

## Required Verification

Before finishing a task, run:

`npm run verify`

That script currently includes:

- renderer typecheck
- node/electron typecheck
- test suite
- Electron build validation

For changes that touch collection UI, item/field/view workflows, import/export, archive restore, IPC contracts, or DB behavior visible through the UI, also run:

`npm run test:e2e`

For larger changes where you want the full confidence pass in one command, run:

`npm run verify:full`

Use `npm run test:e2e:headed` to debug the Electron UI while the Playwright suite runs. E2E temp profiles are removed after each test unless `SECOND_BRAIN_E2E_KEEP_ARTIFACTS=1` is set.

If docs navigation changed, also run:

`npm run docs:build`

## Everything Works Checklist

Before saying "everything works":

- `npm run verify` passes.
- `npm run test:e2e` or `npm run verify:full` passes when the change affects UI/DB workflows covered by E2E.
- Manual testing is limited to native OS dialog appearance, installer/package behavior, subjective layout polish, and new workflows not yet covered by E2E.

## Contribution Rules

- Update docs when user-visible workflows or architectural contracts change.
- Keep UI labels in docs aligned with actual component text.
- Do not document placeholder behavior as if it exists.
- Prefer subsystem docs over sprawling file-by-file inventories.

## Docs Change Checklist

For documentation work, explicitly check:

- sidebar links resolve
- no orphaned pages are left in active nav trees
- architecture statements still match `electron/*` and `src/*`
- field types and settings pages still match `src/types/models.ts`
- import/export and recovery docs still match renderer UI and backend behavior

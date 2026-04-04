# Testing & Contributing

This page summarizes the verification standard for code and documentation changes.

## Source-of-Truth Files

- Renderer tests: `src/__tests__`, `src/composables/**/__tests__`, `src/utils/**/__tests__`, `src/validation/**/__tests__`
- Electron and DB tests: `electron/__tests__`
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

## Required Verification

Before finishing a task, run:

`npm run verify`

That script currently includes:

- renderer typecheck
- node/electron typecheck
- test suite
- Electron build validation

If docs navigation changed, also run:

`npm run docs:build`

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

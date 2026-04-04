# Developer Guide

This guide documents the app by subsystem instead of by individual Vue file. The goal is to make the codebase easier to reason about from the boundaries that matter: Electron boot, IPC contracts, the database worker, renderer state orchestration, and the shared data model.

## Read This First

1. [Setup](./setup)
2. [Architecture](./architecture)
3. [Electron & IPC](./electron-ipc)
4. [Database & Worker](./database-worker)
5. [Renderer & State](./frontend-patterns)

Then use the reference pages for data contracts, import/export behavior, and contribution workflow.

## Source-of-Truth Files

- Electron boot and lifecycle: `electron/main.ts`
- Preload bridge: `electron/preload.ts`
- IPC handlers: `electron/ipc/*.ts`
- Worker protocol and manager: `electron/db/worker-protocol.ts`, `electron/db/worker-manager.ts`
- SQLite schema and queries: `electron/db/*.ts`
- Renderer app shell and store: `src/App.vue`, `src/store.ts`
- Shared model and IPC types: `src/types/models.ts`, `src/types/electron.d.ts`, `src/types/ipc.ts`
- Runtime validation: `src/validation/schemas.ts`

## Documentation Scope

This docs refresh intentionally favors fewer, higher-value pages over file-by-file inventories.

- Use the subsystem pages to understand behavior.
- Use source files and tests for implementation detail.
- Keep docs aligned with the real UI labels and IPC contracts when code changes.

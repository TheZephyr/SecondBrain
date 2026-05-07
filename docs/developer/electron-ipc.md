# Electron & IPC

This page documents the boundary between renderer code and backend execution.

## Source-of-Truth Files

- `electron/main.ts`
- `electron/preload.ts`
- `electron/ipc/db.ts`
- `electron/ipc/backup.ts`
- `electron/ipc/archive.ts`
- `electron/ipc/utils.ts`
- `electron/db/worker-manager.ts`
- `src/types/electron.d.ts`
- `src/types/ipc.ts`

## Main Process Responsibilities

The main process is the integration layer between Electron and the rest of the app.

It owns:

- BrowserWindow creation
- preload script wiring
- dialog flows
- file system reads and writes that should not happen in the renderer
- worker lifecycle
- IPC result shaping into `{ ok, data }` or `{ ok, error }`

## Preload Bridge

`electron/preload.ts` exposes the renderer-safe API as `window.electronAPI`.

The bridge includes grouped methods for:

- collections
- views and view config
- fields
- field type conversion preview and apply
- items, bulk mutations, and numeric field range lookup
- collection import/export file helpers
- backups
- full archive export, preview, and restore
- external URL opening

`src/types/electron.d.ts` is the renderer-facing contract for that surface.

## IPC Handler Pattern

The codebase uses a shared `handleIpc` wrapper in the main process.

Handler behavior is consistent:

1. validate inputs if needed
2. call worker or file-system logic
3. catch errors
4. return a typed `IpcResult<T>`

This keeps renderer error handling uniform and lets `handleIpc` in `src/utils/ipc.ts` centralize toast/reporting behavior.

## Validation Rules

Database-facing IPC endpoints in `electron/ipc/db.ts` validate payloads with schemas from `src/validation/schemas.ts`.

Typical examples:

- positive integer IDs
- item pagination payloads
- view config payloads
- field reorder payloads
- field conversion payloads
- bulk mutation payloads
- backup settings
- archive export input

## Worker Invocation Model

Database handlers forward validated operations to `invokeDbWorker`.

Timeouts vary by workload:

- standard requests use the default request timeout
- bulk mutations use `DB_BULK_TIMEOUT_MS`
- field conversion preview uses the bulk timeout
- field conversion apply creates a `pre_restore` backup first, then uses the
  import timeout for the worker transaction
- imports use `DB_IMPORT_TIMEOUT_MS`
- archive restore uses a longer timeout path

If the worker dies or times out, pending requests fail and the manager can restart the worker.

## Non-Worker IPC Flows

Not every IPC method goes through the worker.

Examples that stay in main:

- save/open dialogs
- raw file read/write for collection export/import and archive disk access
- backup file copy, delete, and folder open
- pre-conversion backup creation before `db:convertFieldType`
- `shell.openExternal()` for URL fields

## Design Constraints

- Renderer payloads must be structured-clone-safe.
- IPC is the only supported path from renderer to persistent data.
- New backend capabilities should be added to the typed preload bridge and documented in `src/types/electron.d.ts`.

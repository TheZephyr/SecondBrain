# Second Brain - Codebase Guide for Agents

> [!NOTE]
> This document is designed to help AI agents understand the architecture, patterns, and conventions of the Second Brain codebase.

## 1. Project Overview

**Second Brain** is a local database application built with:

- **Electron**: Cross-platform desktop framework.
- **Vue 3**: Frontend framework (Composition API).
- **TypeScript**: Strict type safety across the entire stack.
- **SQLite (better-sqlite3)**: Local relational database.
- **Pinia**: State management.
- **Zod**: Runtime validation.
- **TailwindCSS**: Utility-first CSS framework.
- **PrimeVue**: UI component library.

## 2. Architecture

The application follows a strictly separated **Main Process** vs **Renderer Process** architecture, with a specialized **Database Worker** to handle heavy lifting.

### 2.1 Process Separation

- **Main Process** (`electron/main.ts`):
  - Handles window creation and lifecycle.
  - Manages the Database Worker thread.
  - Acts as the IPC broker between Renderer and Database Worker.
  - **Rule**: Never run heavy computations or blocking I/O here (except initial setup).
- **Renderer Process** (`src/`):
  - Vue 3 application.
  - Communicates _only_ via `window.electronAPI` (exposed by `preload.ts`).
  - **Rule**: The Renderer _never_ accesses the database directly. Node integration is disabled.
- **Database Worker** (`electron/db-worker.ts`):
  - Runs in a separate thread.
  - Exclusive access to the SQLite database file.
  - Executes queries synchronously (better-sqlite3 is synchronous) without blocking the UI.

### 2.2 IPC Communication Flow

1.  **Renderer**: Calls `window.electronAPI.someAction(payload)`.
2.  **Preload**: Forwards to Main via `ipcRenderer.invoke('channel', payload)`.
3.  **Main**:
    - Receives IPC call.
    - Validates input using Zod schemas (`src/validation/schemas.ts`).
    - Forwards request to Database Worker via `worker.postMessage()`.
    - Waits for Worker response (Promise).
4.  **Worker**:
    - Executes DB operation.
    - Returns result/error to Main.
5.  **Main**: returns result to Renderer.

**Type Safety**:

- IPC channels are strongly typed.
- All IPC results are wrapped in `IpcResult<T>`: `{ ok: true, data: T } | { ok: false, error: IpcError }`.

### 2.3 IPC Payload Safety (Structured Clone)

- IPC payloads MUST be structured-clone-safe (plain objects, arrays, strings, numbers, booleans, `null`).
- Never pass Vue reactive proxies (`ref`, `reactive`, `computed`, store proxy values) directly to `window.electronAPI`.
- Before IPC calls from Renderer/Pinia, normalize payloads into plain values (e.g., map arrays into new plain objects).
- If you see `An object could not be cloned`, inspect the Renderer callsite payload first.

## 3. Database Patterns

### 3.1 Schema

- **collections**: Groups of items (like tables).
- **fields**: Metadata for columns in a collection.
- **items**: The actual data. stored as a JSON blob in the `data` column.

**Key constraint**: The `items.data` column is a JSON string. Core CRUD still treats it as a whole object, but list/search/sort performance logic may query JSON inside SQL in the Worker (e.g., `json_extract`, `json_each`, FTS index content generation). Keep this logic in the Worker, never in Renderer.

### 3.2 Transactions

- Import/Export operations MUST use transactions (`db.transaction(...)`).
- "Replace" mode imports delete existing items within the transaction.
- Any multi-step mutation MUST execute as a single transaction in the Worker.
- Do not implement multi-step writes from Renderer loops (multiple sequential IPC calls) when atomicity is required.

### 3.3 Field Order Integrity + Bulk Mutations

- Field ordering is DB-enforced unique per collection via `idx_fields_collection_order_unique` on `(collection_id, order_index)`.
- Worker startup normalizes existing field order (`order_index ASC, id ASC`) before creating/ensuring that index.
- `addField` fallback order must use `MAX(order_index) + 1` (never hardcode `0` for omitted order).
- Reordering fields uses `db:reorderFields` and is all-or-nothing:
  - payload must contain the full field set for the collection, exactly once,
  - `orderIndex` values must be contiguous `0..n-1`,
  - invalid/missing IDs must fail and rollback.
- Renderer reorder UIs that hide unsupported fields MUST still include those hidden field IDs in `fieldOrders` (or disable reorder) so the payload stays complete.
- Bulk item writes are backend-only APIs and are all-or-nothing:
  - `db:bulkDeleteItems` and `db:bulkPatchItems`,
  - if any target ID is invalid for the collection, the entire transaction fails and rolls back.
- Import-created fields must assign `orderIndex` from `MAX(order_index) + 1` across all existing collection fields (including hidden/unsafe legacy fields), never by visible/safe-field count.

### 3.4 Query Scalability Rules

- User-facing list endpoints MUST be paginated (`limit` + `offset`) and MUST return total count metadata.
- Do not ship unbounded list fetches (`SELECT * ...` without `LIMIT/OFFSET`) for collection items.
- Search and sort on large item sets must run in the Worker/SQL layer, not by scanning full arrays in Renderer.
- Sort/search inputs must be validated in Main with Zod and constrained to safe, explicit fields.
- If an optimization path (e.g., FTS) is unavailable, implement a safe fallback (e.g., `LIKE`) rather than crashing.

## 4. State Management (Pinia)

- **Store**: `src/store.ts` contains the `useStore` (main application state).
- **Pattern**: state in Pinia mirrors the database state.
- **Synchronization**:
  - Actions (e.g., `addCollection`) call the API _first_.
  - Wait for successful response.
  - Then reload the relevant list (e.g., `loadCollections()`).
  - _Current Approach_: We generally re-fetch lists after mutation rather than manual optimistic updates, to ensure consistency.

### 4.1 Async Concurrency Rules

- For async list loads, guard against stale responses (request token / sequence id pattern).
- Collection switching must reset collection-scoped list query state (page/search/sort/loading context).
- Collection view query orchestration lives in `src/composables/collection/useCollectionItemsQuery.ts`; avoid duplicating item-load triggers across multiple components/watchers.
- Do not normalize/persist saved multi-sort state against an uninitialized or transiently empty `safeFields` snapshot during collection switches; this can erase valid saved sort preferences.

## 5. Validation (Zod)

- **Location**: `src/validation/schemas.ts`.
- **Usage**:
  - **Renderer**: Can use schemas for form validation (e.g., PrimeVue Forms).
  - **Main Process**: _MUST_ validate all IPC inputs using `parseOrThrow`.
  - **Worker**: Assumes valid input (since Main validated it), but handles DB constraints.
- **Custom Rules**:
  - Field names have strict regex/refinement checks (`isSafeFieldName`).
  - Item data must be a plain object, no custom prototypes.
  - Bulk guards are capped (`MAX_BULK_DELETE_IDS = 1000`, `MAX_BULK_PATCH_UPDATES = 500`).

## 6. File Organization

- `electron/`: Main process and worker code.
  - `main.ts`: Entry point.
  - `preload.ts`: Context bridge.
  - `db-worker.ts`: Database logic.
  - `db-worker-protocol.ts`: Types for Worker communication.
- `src/`: Renderer code.
  - `components/`: Vue components.
    - `views/Collection.vue`: Thin orchestration view for collection screen.
    - `views/collection/`: Collection feature components (`CollectionHeaderBar`, `CollectionItemsPanel`, `CollectionItemEditorDialog`, `CollectionFieldsDialog`, `CollectionSettingsDialog`, and local `types.ts`).
  - `composables/collection/`: Collection-specific logic (`useSafeFields`, `useCollectionItemsQuery`, `useCollectionItemForm`) and their tests.
  - `store.ts`: Main Pinia store.
  - `stores/`: Feature-specific stores (e.g., notifications).
  - `types/`: Shared TypeScript interfaces.
  - `utils/`: Helper functions (IPC handling, formatting).
  - `validation/`: Zod schemas.

## 7. Conventions for Agents

1.  **Adding Features**:
    - Define Types (`src/types/models.ts`).
    - Define Validation (`src/validation/schemas.ts`).
    - Update `electron/db-worker-protocol.ts` to include new message types.
    - Implement DB logic in `electron/db-worker.ts`.
    - Add IPC handler in `electron/main.ts` (with validation!).
    - Expose in `electron/preload.ts`.
    - Add to Store (`src/store.ts`).
    - Create UI Component.
    - Add/adjust tests for schemas and data logic changes.
    - For Worker logic changes, add/adjust tests in `electron/__tests__/`.

2.  **Safety**:
    - Never introduce `remote` module or `nodeIntegration: true`.
    - Always parse inputs in Main process.
    - Handle IPC errors gracefully in the UI (`src/utils/ipc.ts` helper).

3.  **UI/UX**:
    - Use PrimeVue components where possible for consistency.
    - Use `tailwind` classes for layout and spacing.
    - Respect the dark/light theme tokens (if present, else use standard colors).

4.  **Collection View Boundaries**:
    - Keep `src/components/views/Collection.vue` as an orchestrator; put feature-heavy UI and logic in `src/components/views/collection/` and `src/composables/collection/`.
    - Do not call `store.selectCollection(...)` from `Collection.vue`; selection is owned by higher-level navigation/view flow.
    - Keep sort persistence key compatibility as `multi_sort_${collectionId}` unless a migration path is intentionally introduced.
    - `useCollectionImportExport` should be consumed by collection settings/import-export UI (currently `CollectionSettingsDialog.vue`), not the top-level view.

## 8. Verification Checklist (Before Finishing)

- Run tests: `cmd /c npm test`
- Run renderer type-check: `cmd /c npx vue-tsc --noEmit`
- Run node/electron type-check: `cmd /c npx tsc --noEmit -p tsconfig.node.json`
- If Electron process code changed, run build check: `cmd /c npm run build:electron`
- Manually smoke test any changed large-list UX paths (pagination/search/sort/export) in app.

## 9. Native Module ABI (Important)

- `better-sqlite3` is native and can break when Node/Electron ABI versions differ (`NODE_MODULE_VERSION` errors).
- Use the scripts in `package.json`:
  - `cmd /c npm run rebuild:node-native` for Node-based workflows (tests/typecheck scripts that run under Node),
  - `cmd /c npm run rebuild:electron-native` for Electron app workflows (`dev`, `build:electron`).
- `pretest`, `predev:electron`, and `prebuild:electron` already run these rebuilds automatically, but rerun manually if ABI mismatch appears.

# Codebase Guide for Agents

## 2. Architecture

### 2.1 Process Separation

- Never run heavy computations or blocking I/O in main process (except initial setup).
- The Renderer _never_ accesses the database directly. Node integration is disabled.

### 2.2 IPC Payload Safety (Structured Clone)

- IPC payloads MUST be structured-clone-safe (plain objects, arrays, strings, numbers, booleans, `null`).
- Never pass Vue reactive proxies (`ref`, `reactive`, `computed`, store proxy values) directly to `window.electronAPI`.
- Before IPC calls from Renderer/Pinia, normalize payloads into plain values (e.g., map arrays into new plain objects).
- If you see `An object could not be cloned`, inspect the Renderer callsite payload first.

### 2.3 Error Recovery & Resilience

- The UI must handle IPC failures by showing error toasts (via the `handleIpc` helper) and disabling affected features. Never crash the Renderer process.
- Do NOT implement automatic retries for mutations. The user must re-trigger failed operations explicitly to prevent IPC flooding.
- If the Database Worker is unready or busy, pending requests should fail fast rather than hanging the UI indefinitely.

## 3. Database Patterns

### 3.1 Key constraint

- The `items.data` column is a JSON string. Core CRUD still treats it as a whole object, but list/search/sort performance logic may query JSON inside SQL in the Worker (e.g., `json_extract`, `json_each`, FTS index content generation). Keep this logic in the Worker, never in Renderer.

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

### 3.5 Schema Migrations

- The database schema version is tracked using SQLite's `PRAGMA user_version`.
- Never instruct the user to delete their database to resolve schema conflicts. This is a local-first application; data loss is unacceptable.
- If you alter existing collections/fields or core indices, you MUST write an incremental migration script in the DB initialization flow that checks `user_version` and executes `ALTER TABLE` or safe data backfill operations.

### 3.6 JSON Blob Serialization Boundary

Three columns in the schema store structured data as JSON blobs: `items.data`, `fields.options`, and `views.config`. SQLite cannot enforce the structure of these blobs, so the application layer is the only enforcement point.

Rules:
- Every read from these columns MUST go through a single designated deserializer:
  - `items.data` → `itemDataSchema` (Zod, in `src/validation/schemas.ts`)
  - `fields.options` → `parseFieldOptions` (in `src/utils/fieldOptions.ts`)
  - `views.config` → `parseStoredViewConfig` (in `electron/db-worker.ts`)
- Every write to these columns MUST go through the corresponding serializer.
- Ad-hoc `JSON.parse` or `JSON.stringify` calls directly against these columns are forbidden outside those designated functions.
- If a new blob column is added to the schema, a designated serializer/deserializer pair MUST be created before any read/write code is written.

### 3.7 View Config Blob

The `views.config` column stores presentation state (column widths, sort, field visibility, grouping) as a JSON blob. Do not attempt to decompose this into separate table columns — variable-length structures like column widths and sort specs would require junction tables that add join complexity with no meaningful benefit, since this is a user preferences store rather than relational data.

The canonical schema for this blob is `ViewConfigSchema` in `src/validation/schemas.ts`. All reads and writes must go through the designated serializer/deserializer pair per rule 3.6. If the config structure needs to evolve, update the Zod schema and handle defaults in the deserializer — do not add SQL migrations for config shape changes.

## 4. State Management (Pinia)

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

### 4.2 UI to Database Throttling

- Never bind rapid UI events (like keystrokes in a search bar or continuous slider movements) directly to IPC calls.
- Any continuous input that triggers a database query or mutation MUST be debounced (e.g., using VueUse's `useDebounceFn`) to prevent IPC flooding and Worker thread bottlenecking.

## 5. Validation (Zod)

- **Usage**:
  - **Renderer**: Can use schemas for form validation (e.g., PrimeVue Forms).
  - **Main Process**: _MUST_ validate all IPC inputs using `parseOrThrow`.
  - **Worker**: Assumes valid input (since Main validated it), but handles DB constraints.
- **Custom Rules**:
  - Field names have strict regex/refinement checks (`isSafeFieldName`).
  - Item data must be a plain object, no custom prototypes.
  - Bulk guards are capped (`MAX_BULK_DELETE_IDS = 1000`, `MAX_BULK_PATCH_UPDATES = 500`).

## 7. Conventions for Agents

### 7.1. Adding Features

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

### 7.2. Safety

    - Never introduce `remote` module or `nodeIntegration: true`.
    - Always parse inputs in Main process.
    - Handle IPC errors gracefully in the UI (`src/utils/ipc.ts` helper).

### 7.3. UI/UX

    - Use PrimeVue components where possible for consistency.
    - Use `tailwind` classes for layout and spacing.
    - Respect the dark/light theme tokens (if present, else use standard colors).

### 7.4. Collection View Boundaries

    - Keep `src/components/views/Collection.vue` as an orchestrator; put feature-heavy UI and logic in `src/components/views/collection/` and `src/composables/collection/`.
    - Do not call `store.selectCollection(...)` from `Collection.vue`; selection is owned by higher-level navigation/view flow.
    - Keep sort persistence key compatibility as `multi_sort_${collectionId}` unless a migration path is intentionally introduced.
    - `useCollectionImportExport` should be consumed by collection settings/import-export UI (currently `CollectionSettingsPanel.vue`), not the top-level view.

### 7.5 Observability & Debugging

- Use consistent prefixes for console logs when adding new handlers: `[Main IPC: channelName]`, `[DB Worker: operation]`, `[Store: action]`.
- All IPC errors must include a context field (the channel name). If throwing an error from the Worker, include the failed query parameters in the error payload for easier debugging.
- Use `NODE_ENV=development` checks to output verbose Worker logs; keep them silent in production.

### 7.6 Testing Strategy Guidelines

- When testing Vue components or Pinia stores, you MUST mock `window.electronAPI`. Do not attempt to spin up the actual Main process or Worker in Renderer tests.
- Always return mock `IpcResult<T>` objects (e.g., `{ ok: true, data: ... }`) from your mocked endpoints to simulate the Main process correctly.
- Test DB operations exclusively with an in-memory SQLite database (`:memory:`).
- Rely on your Zod schemas as runtime contract tests at the IPC boundary.

## 8. Verification Checklist (Before Finishing)

- Run tests: `cmd /c npm test`
- Run renderer type-check: `cmd /c npx vue-tsc --noEmit`
- Run node/electron type-check: `cmd /c npx tsc --noEmit -p tsconfig.node.json`
- If Electron process code changed, run build check: `cmd /c npm run build:electron`
- Manually smoke test any changed large-list UX paths (pagination/search/sort/export) in app.
- If the schema was modified, manually test import/export workflows with legacy data files to ensure backward compatibility.
- Test collection switching, search, sort, and pagination in rapid combination to ensure state clears and aborts correctly.

## 9. Native Module ABI (Important)

- `better-sqlite3` is native and can break when Node/Electron ABI versions differ (`NODE_MODULE_VERSION` errors).
- Use the scripts in `package.json`:
  - `cmd /c npm run rebuild:node` for Node-based workflows (tests/typecheck scripts that run under Node),
  - `cmd /c npm run rebuild:electron` for Electron app workflows (`dev`, `build:electron`).

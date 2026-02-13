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

## 3. Database Patterns

### 3.1 Schema

- **collections**: Groups of items (like tables).
- **fields**: Metadata for columns in a collection.
- **items**: The actual data. stored as a JSON blob in the `data` column.

**Key constraint**: The `items.data` column is a JSON string. We query fields inside this JSON in the application layer, not deeply in SQL (currently).

### 3.2 Transactions

- Import/Export operations MUST use transactions (`db.transaction(...)`).
- "Replace" mode imports delete existing items within the transaction.

## 4. State Management (Pinia)

- **Store**: `src/store.ts` contains the `useStore` (main application state).
- **Pattern**: state in Pinia mirrors the database state.
- **Synchronization**:
  - Actions (e.g., `addCollection`) call the API _first_.
  - Wait for successful response.
  - Then reload the relevant list (e.g., `loadCollections()`).
  - _Current Approach_: We generally re-fetch lists after mutation rather than manual optimistic updates, to ensure consistency.

## 5. Validation (Zod)

- **Location**: `src/validation/schemas.ts`.
- **Usage**:
  - **Renderer**: Can use schemas for form validation (e.g., PrimeVue Forms).
  - **Main Process**: _MUST_ validate all IPC inputs using `parseOrThrow`.
  - **Worker**: Assumes valid input (since Main validated it), but handles DB constraints.
- **Custom Rules**:
  - Field names have strict regex/refinement checks (`isSafeFieldName`).
  - Item data must be a plain object, no custom prototypes.

## 6. File Organization

- `electron/`: Main process and worker code.
  - `main.ts`: Entry point.
  - `preload.ts`: Context bridge.
  - `db-worker.ts`: Database logic.
  - `db-worker-protocol.ts`: Types for Worker communication.
- `src/`: Renderer code.
  - `components/`: Vue components.
  - `stores/`: Pinia stores.
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

2.  **Safety**:
    - Never introduce `remote` module or `nodeIntegration: true`.
    - Always parse inputs in Main process.
    - Handle IPC errors gracefully in the UI (`src/utils/ipc.ts` helper).

3.  **UI/UX**:
    - Use PrimeVue components where possible for consistency.
    - Use `tailwind` classes for layout and spacing.
    - Respect the dark/light theme tokens (if present, else use standard colors).

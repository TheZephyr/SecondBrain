# Renderer & State

This page covers the renderer-side architecture: app shell composition, Pinia state ownership, collection query orchestration, and the UI stack.

## Source-of-Truth Files

- App shell: `src/main.ts`, `src/App.vue`
- Compatibility facade and domain stores: `src/store.ts`, `src/stores/*.ts`
- Renderer repositories: `src/repositories/*.ts`
- Layout shell: `src/components/layout/**`
- Collection workspace: `src/components/collections/**`
- Collection composables: `src/composables/collection/**`
- Shared renderer utilities: `src/utils/**`

## Renderer Stack

- Vue 3 with Composition API and `<script setup>`
- Pinia setup stores
- shadcn-vue primitives plus app-level wrappers in `src/components/app/ui/**`
- Tailwind CSS 4 utilities plus app-level CSS variables in `src/style.css`
- TanStack Table and virtualization for the grid

## App Shell

`src/main.ts` creates the Vue app, installs Pinia, imports the global renderer stylesheet, and sets the renderer into dark mode at bootstrap.

`src/App.vue` is intentionally thin:

- renders `AppSidebar`
- renders `AppContent`
- renders the global `AppToaster`
- renders the global `AppConfirmDialog`

## State Ownership

### Domain Stores

Renderer state is split by responsibility:

- `src/stores/navigation.ts` owns the active app section plus collection panel UI state.
- `src/stores/collections.ts` owns collections, selected collection metadata, fields, views, and normalized view config persistence.
- `src/stores/items.ts` owns paginated item state plus item mutations.
- `src/stores/settings.ts` owns backup and archive UI state for global settings.
- `src/stores/notifications.ts` remains the toast queue.

`src/store.ts` is now a compatibility facade that coordinates cross-store flows such as collection switching and dashboard/settings navigation.

### Repositories

Renderer repositories in `src/repositories/**` are the only renderer layer that should talk to `window.electronAPI`.

They own:

- IPC request execution
- `handleIpc` fallback behavior
- grouping endpoints by collection/view/item/settings/system concerns

Components and composables should depend on stores or repositories, not on raw preload calls.

### Notifications Store

`src/stores/notifications.ts` is a simple queue store for toast messages. Components and helpers push messages there; `AppToaster.vue` consumes the queue and maps severities to Sonner toasts.

### Confirm Flow

Destructive confirmation flows use the renderer-local confirm service in `src/components/app/ui/confirm-service.ts`.

- call `useAppConfirm().confirm(...)` from components or composables
- `AppConfirmDialog.vue` renders the active request with shadcn `AlertDialog`
- the API resolves to `Promise<boolean>` so call sites stay linear and service-free

## Query Orchestration

The collection workspace splits orchestration across the stores and composables.

- `useCollectionItemsQuery` owns debounced search, persisted multi-sort, and page loading.
- `useSafeFields` filters field definitions into a renderer-safe ordered list.
- `useCollectionKanban` and `useCollectionCalendar` translate shared item state into view-specific display and mutations.
- Grid-specific composables handle column sizing, selection, and inline editing.

The current approach is deliberately selective about refetching:

- add, insert, duplicate, reorder, import, and collection switching still reload item data
- inline update, boolean toggle, bulk patch, and delete patch the visible item state locally
- view config normalization lives in `src/utils/viewConfig.ts`

## View Model

`src/components/collections/Collection.vue` is the renderer-side collection orchestrator.

It decides whether the active surface is:

- source-view field management
- child-view field visibility management
- grid data view
- kanban data view
- calendar data view
- collection settings

That component should stay orchestration-heavy and delegate feature logic to dedicated components and composables.

## Styling Model

Renderer styling combines:

- Tailwind layout and spacing classes
- shadcn component tokens and primitives
- app CSS variables and fonts in `src/style.css`

## UI Composition

The migration splits renderer UI into two layers:

- `src/components/app/ui/**` provides normalized controls such as `AppButton`, `AppDialog`, `AppSelect`, `AppToaster`, and `AppConfirmDialog`
- `src/components/ui/**` contains generated shadcn-vue primitives for low-level composition such as dialogs, popovers, dropdown menus, tables, commands, and form fields

This keeps repeated app-wide behavior stable while still allowing feature screens to build custom overlays and editors directly from shadcn primitives.

Docs and implementation should refer to the actual UI labels from components, not generic placeholder names.

## Constraints

- Do not bypass repositories with ad-hoc repeated IPC flows.
- Guard async state with request tokens where stale responses are possible.
- Keep rapid UI events like search debounced before they trigger IPC.
- Persist per-view presentation state through view config instead of local component-only state when it needs to survive reloads.

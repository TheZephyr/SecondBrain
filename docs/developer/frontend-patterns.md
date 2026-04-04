# Renderer & State

This page covers the renderer-side architecture: app shell composition, Pinia state ownership, collection query orchestration, and the UI stack.

## Source-of-Truth Files

- App shell: `src/main.ts`, `src/App.vue`
- Global state: `src/store.ts`, `src/stores/notifications.ts`
- Layout shell: `src/components/layout/**`
- Collection workspace: `src/components/collections/**`
- Collection composables: `src/composables/collection/**`
- Shared renderer utilities: `src/utils/**`

## Renderer Stack

- Vue 3 with Composition API and `<script setup>`
- Pinia setup stores
- PrimeVue components and services
- Tailwind CSS 4 utilities plus app-level CSS variables in `src/style.css`
- TanStack Table and virtualization for the grid

## App Shell

`src/main.ts` creates the Vue app, installs Pinia, PrimeVue, confirmation, and toast services, and applies the custom theme preset.

`src/App.vue` is intentionally thin:

- renders `AppSidebar`
- renders `AppContent`
- drains the notifications queue into PrimeVue toasts

## State Ownership

### Main Store

`src/store.ts` is the primary renderer orchestrator.

It owns:

- collection list
- selected collection
- active app section (`dashboard`, `collection`, `settings`)
- current views and active view ID
- fields
- paginated items, search state, and sort state
- collection panel state and collection settings visibility

The store is the main renderer entrypoint to `window.electronAPI`.

### Notifications Store

`src/stores/notifications.ts` is a simple queue store for toast messages. Components and helpers push messages there; `App.vue` consumes the queue and forwards it to PrimeVue toast service.

## Query Orchestration

The collection workspace splits orchestration across the store and composables.

- `useCollectionItemsQuery` owns debounced search, persisted multi-sort, and page loading.
- `useSafeFields` filters field definitions into a renderer-safe ordered list.
- `useCollectionKanban` and `useCollectionCalendar` translate shared item state into view-specific display and mutations.
- Grid-specific composables handle column sizing, selection, and inline editing.

The current approach is deliberately not optimistic by default. Mutations usually call IPC first and then reload the relevant data set.

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
- PrimeVue components
- app CSS variables and fonts in `src/style.css`

Docs and implementation should refer to the actual UI labels from components, not generic placeholder names.

## Constraints

- Do not bypass the store or composables with ad-hoc repeated IPC flows.
- Guard async state with request tokens where stale responses are possible.
- Keep rapid UI events like search debounced before they trigger IPC.
- Persist per-view presentation state through view config instead of local component-only state when it needs to survive reloads.

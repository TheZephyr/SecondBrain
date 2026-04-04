# Planned Features

This page tracks product gaps that are still unfinished in the current codebase.

## Bulk Select & Bulk Actions in the Grid

**Current state**

- Backend support already exists for `bulkDeleteItems` and `bulkPatchItems`.
- Grid row selection state exists locally in the grid layer.
- There is no shipped bulk action toolbar or user-facing bulk mutation flow.

**What is still missing**

- A visible selection summary in the grid UI.
- Bulk action controls such as delete or patch.
- Confirmation and result feedback wired to the existing backend endpoints.

This is mainly a renderer and interaction gap, not a database capability gap.

## Sort Management UI

**Current state**

- Grid multi-sort works from column headers.
- Sort state persists per view through view config.
- The toolbar `Sort` button only reflects whether a sort is active.

**What is still missing**

- A clickable sort-management surface.
- UI for reviewing, reordering, or removing active sort levels without using column headers.

This is a product-surface gap. The persistence and query layers already support multi-sort.

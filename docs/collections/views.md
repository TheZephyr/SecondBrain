# Views

## Overview

A view is a named, saved perspective on a collection's data. Each collection can have multiple views. Views are listed under their collection in the sidebar. View-specific settings (sort order, column widths) are persisted per view.

## View Types

| Type       | Status        | Description                                      |
|------------|---------------|--------------------------------------------------|
| `grid`     | Available     | Spreadsheet-style table with inline editing      |
| `kanban`   | Planned       | Card-based board grouped by a select field       |
| `calendar` | Planned       | Calendar layout using a date field               |

## Creating a View

Click "Add view" under a collection in the sidebar. A picker shows the available view types. After selecting a type, a dialog prompts for a name. The name defaults to the type label (e.g. "Grid") with a numeric suffix if that name is already taken (e.g. "Grid 2").

## Renaming a View

Click the pencil icon that appears on hover next to a view name in the sidebar. A dialog opens pre-filled with the current name.

## Deleting a View

Click the trash icon that appears on hover next to a view name. A confirmation popover appears inline. Deleting a view does not affect items or fields. If the deleted view was the active one, the app switches to the first remaining view.

## Active View

The currently selected view is highlighted in the sidebar. Only one view is active at a time per collection. The active view ID is stored in app state and reset when switching collections.

## Default View

Each collection has one default view (the Grid view created automatically on collection creation). The default view is restored as the active view when navigating to a collection from the Dashboard or sidebar.

---

## Grid View

The Grid view is the primary data view. It renders items as rows and fields as columns in a virtualized table.

### Column Widths

Column widths are resizable by dragging the right edge of any column header. The minimum width is 60 px. Width changes are persisted to the view config in the database when the drag ends.

### Sort Persistence

Sort state (field + direction, up to 3 levels) is saved to the view config. It is restored when the view is next opened, after the collection's fields have loaded. Sorts referencing fields that no longer exist are silently dropped.

### Toolbar

The toolbar contains:
- **Filter** button — placeholder, not yet functional
- **Sort** button — visually active when a sort is applied (no modal yet; sorting is done via column header clicks)
- **Search bar** — debounced full-text search

---

## Kanban View

**Status: planned stub.** The view type exists and can be created, but renders a "coming soon" message. See [Planned Features](./planned-features.md) for intended behavior.

---

## Calendar View

**Status: planned stub.** The view type exists and can be created, but renders a "coming soon" message. See [Planned Features](./planned-features.md) for intended behavior.

---

## View Config Schema

Each view stores an optional JSON config blob with:

```
{
  columnWidths: { [fieldId: number]: number },
  sort: [{ field: "data.<fieldName>", order: 1 | -1 }]
}
```

Column width keys are field IDs (positive integers). Sort fields must reference a safe field name prefixed with `data.`.
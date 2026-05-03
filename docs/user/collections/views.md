# Views

Views change how the same collection data is presented. Second Brain supports grid, kanban, and calendar views.

## View Types

### Grid

The grid is the default data-entry and review surface.

- Best for bulk editing and scanning many rows.
- Supports inline editing, search, multi-sort, row actions, and column resizing.

### Kanban

Kanban groups items into columns using a select field.

- Requires at least one `select` field in the collection.
- If multiple select fields exist, the child view chooses one grouping field.
- Each board also chooses a `Card title` field used for the first, larger line on every card.
- Cards can be dragged between columns.
- Column order can also be rearranged.

### Calendar

Calendar places items on days using a date field.

- Requires at least one `date` field in the collection.
- If more than one date field exists, the child view chooses which one to use.
- Month navigation is built into the calendar toolbar.

## Default Source View and Child Views

Each collection has:

- One locked default source view.
- Zero or more child views.

The source view is the base view for the collection. Child views inherit the collection schema but can store their own presentation settings.

## Create a Child View

1. Expand a collection in the sidebar.
2. Click `Add view`.
3. Choose `Grid`, `Kanban`, or `Calendar`.
4. Enter a `View Name`.
5. If needed, choose:
   - `Stacked by` for kanban.
   - `Card title` for kanban.
   - `Date field` for calendar.
6. Click `Create View`.

## Rename, Delete, and Reorder Child Views

Child views in the sidebar support:

- Rename.
- Delete.
- Drag to reorder.

The locked source view cannot be deleted from the sidebar.

## Configure a Child View

Open the child view, then click `Fields` in the top bar.

### Child Grid Views

- Choose the visible field subset.
- Reorder visible fields for that view.
- Persist per-view sort and column widths.

### Child Kanban Views

- Choose which fields appear on cards.
- Choose the `Card title` field shown as the larger first line on each card.
- Set the select field used for column grouping.
- Card details show the selected visible fields below the title with the field type icon, field name, optional description hint, and value.
- Drag cards between columns to update the item's grouping value.
- Drag columns to persist their display order.

### Child Calendar Views

- Choose which fields are visible for entries.
- Set the date field used to place items on the calendar.

## Empty and Recovery States

Some views intentionally show guidance instead of empty data:

- Kanban with no select fields: `No Select Fields`
- Kanban with a deleted grouping field: `Grouping Field Missing`
- Kanban with multiple candidates but no selection: `Choose a Select Field`
- Calendar with no date fields: `No Date Fields`
- Calendar with multiple candidates but no selection: `Choose a Date Field`

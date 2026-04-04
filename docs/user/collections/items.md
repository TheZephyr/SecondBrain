# Items

An item is one record in a collection. In the grid, items are rows. In kanban and calendar views, the same items are shown as cards or dated entries.

## Add Items in the Grid

The grid includes an add row at the bottom with a `+` cell.

1. Click the `+` row.
2. The app creates a new item using your field defaults.
3. The first field enters edit mode so you can begin typing immediately.

## Add Items in Kanban

Each kanban column includes a `+` button.

1. Click the `+` button on a column.
2. The `Add New Item` dialog opens.
3. The grouping field is prefilled with that column's value.
4. Complete the remaining fields and save.

## Edit Items

You can edit items in two main ways.

### Inline Grid Editing

- Click a grid cell to edit it directly.
- Press `Enter` to commit and move through the row.
- Date, select, multiselect, boolean, URL, and rating values use field-specific editors.

### Dialog Editing

- Open an item from a kanban card or calendar entry.
- The `Edit Item` dialog shows all visible fields for that view.
- The same dialog is also used when a new item is created from kanban.

## Search and Sort

Grid data tools are view-aware.

- Use the `Search...` input in the grid toolbar to filter items.
- Sorting is applied from grid column headers.
- Shift-clicking additional column headers creates multi-sort order.
- The `Sort` toolbar button is currently only a state indicator. Sort changes come from the column headers.

Search and sort state is stored per view, not globally across the whole app.

## Duplicate Warnings

If a field has `uniqueCheck` enabled:

- Duplicate values are highlighted in the grid.
- The item dialog marks duplicate fields while you edit.

This helps catch collisions without blocking the save.

## Row Actions in the Grid

Right-click a row in the grid to open row actions:

- `Insert row above`
- `Insert row below`
- `Duplicate row`
- `Move up`
- `Move down`
- `Delete row`

## URL Fields

URL fields stay editable as text, but they also include an open-link action.

- In the grid, click the link icon inside the cell.
- In the item dialog, click the link icon beside the field.

The app asks the operating system to open the URL externally.

## Pagination and Loading

Item lists are loaded in pages behind the scenes.

- The grid loads more rows as needed.
- Search and sort reset the list back to the first page.
- Kanban and calendar views can request more items when they need the full data set for the current view state.

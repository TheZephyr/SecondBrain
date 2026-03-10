# Items

## Overview

Items are the rows of a collection. Each item holds a `data` object — a flat key-value map where keys are field names and values are strings, numbers, or null. Items have an explicit `order` value that controls display sequence independently of insertion time.

## Adding Items

**Via the Add Row button:** Clicking the `+` row at the bottom of the grid creates an item with empty data and immediately places the cursor in the first field for inline editing.

**Via the item editor dialog:** The dialog provides a form with a dedicated input for each field type, including a date picker, number input, and select dropdown. It is accessible by clicking the expand icon on any row, or via "Add New Item" if present.

## Inline Editing (Grid)

Every cell in the grid supports inline editing:

- **Single click** selects a cell (highlights it)
- **Double click** activates the editor for that cell
- **Enter** commits the edit
- **Escape** cancels without saving
- **Tab** commits and moves to the next cell (wraps to the first field of the next row)

Edits are saved immediately to the database on commit. If the new value equals the existing value, no write is performed.

Clicking outside any grid cell clears the selection.

## Row Context Menu

Right-clicking any row opens a context menu with the following actions:

- **Insert row above / below** — inserts an empty row at the specified position, shifting existing rows
- **Duplicate row** — copies the row's data into a new row inserted immediately below
- **Move up / down** — swaps the row with its neighbor; disabled at the top or bottom of the loaded page
- **Delete row** — removes the row after confirmation

## Searching

The search bar in the grid toolbar filters items in real time. Input is debounced (default 200 ms) before triggering a database query. Search is performed across all field values using full-text search (FTS5 with `unicode61` tokenizer) when available, falling back to `LIKE`-based matching per token otherwise.

Multiple space-separated tokens are treated as AND conditions — all tokens must match.

## Sorting

Column headers are clickable to sort:

- First click: sort ascending
- Second click: sort descending  
- Third click: clear sort for that column

Holding **Shift** while clicking adds a column to a multi-sort (up to 3 levels). Sort state is persisted to the active view's config and restored the next time the view is opened.

Sorting is performed in the database using `json_extract` on the item data column, with `COLLATE NOCASE` for text fields and numeric ordering for number fields.

## Pagination

Items are loaded in pages of 100. When scrolling near the bottom of the list, the next page is automatically fetched and appended (infinite scroll). The footer shows the total row count for the current search/sort context.

## Bulk Operations

Bulk delete and bulk patch are available programmatically (used by import/export and future UI features). Both operations are all-or-nothing transactions: if any item ID in the payload does not belong to the specified collection, the entire operation rolls back.

- Bulk delete: up to 1,000 item IDs per call
- Bulk patch: up to 500 updates per call; each update must include at least one field

## Item Order

Items have an explicit `order` column. Inserting above/below and move up/down operations update this column. New items appended via the Add Row button receive `MAX(order) + 1`. The order column is separate from the database row ID, so reordering never changes item IDs.

## Constraints

- Item data values: string, number (finite), or null — no nested objects or arrays
- Field names in item data are validated against the same safety rules as field definitions
- Items are always scoped to one collection; cross-collection queries are not supported
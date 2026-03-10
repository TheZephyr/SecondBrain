# Fields

## Overview

Fields define the schema of a collection. Each field maps to a named column that every item in the collection can hold a value for. Fields are managed from the **Fields panel** (accessible via the "Fields" tab in the top navbar).

## Field Types

| Type       | Description                                                                 |
|------------|-----------------------------------------------------------------------------|
| `text`     | Single-line plain text                                                      |
| `textarea` | Multi-line plain text                                                       |
| `number`   | Numeric value (integer or float). Stored and sorted numerically             |
| `date`     | Calendar date. Stored as `YYYY-MM-DD`. Displayed using the locale format    |
| `select`   | Single value chosen from a predefined list of options                       |

## Adding a Field

Fields are added from the bottom of the Fields panel. A name, type, and (for `select` fields) a comma-separated list of options must be provided. The field is appended after all existing fields.

**Name constraints:**
- 1–64 characters
- Must start with a letter or digit
- Allowed characters: letters, digits, spaces, `_`, `-`
- No dots (`.`)
- Cannot be a reserved name (`__proto__`, `prototype`, `constructor`)
- Leading or trailing spaces are not allowed

## Reordering Fields

Fields can be dragged and reordered within the Fields panel. The reorder operation is all-or-nothing: the full ordered list of every field in the collection must be submitted together. If any field ID in the payload is invalid or missing, the entire reorder is rolled back and no changes are saved.

Hidden (unsafe) fields — fields that fail the name safety check — are excluded from the visible list but are always included in the reorder payload transparently, so they are never accidentally dropped.

## Deleting a Field

Fields can be deleted from the Fields panel. Deletion is confirmed via a dialog. Deleting a field does **not** remove its data from existing items — the data remains in the item JSON but will no longer be displayed or editable because no matching field definition exists.

## Select Field Options

Options for `select` fields are entered as a comma-separated string (e.g. `To Read, Reading, Done`). Options are trimmed of whitespace. There is no fixed limit on the number of options. Each option is rendered as a color-coded chip; the color is derived from the option's position in the list using an HSL hue spread.

## Unsafe / Hidden Fields

Fields whose names fail the safety check are hidden from the UI and excluded from sorting, searching, and editing. A one-time warning toast is shown per hidden field. These fields still exist in the database and are preserved during reorders and imports to avoid data loss.

## Constraints

- Field names: validated by `isSafeFieldName` (see above)
- Field order is enforced by a unique index `(collection_id, order_index)` in the database
- Order indices are contiguous starting at 0
- Sort operations in the UI are limited to fields that pass the safety check
# Import & Export

## Overview

Import and export are available from the **Collection Settings** panel, under the "Export Data" and "Import Data" accordion sections.

Both CSV and JSON formats are supported. All operations are scoped to a single collection.

---

## Export

### Process

1. Select a format (CSV or JSON)
2. Click "Export N items"
3. A system save dialog opens with a suggested filename: `<collection-name>-<YYYY-MM-DD>.<format>`
4. The app fetches all items in pages of 200 (bypassing the normal 100-item UI page size) and writes the complete file

### CSV Format

- Headers are field names in `order_index` order
- All values are quoted and internal quotes are escaped as `""`
- Null values export as an empty quoted string `""`
- Newline-delimited rows

### JSON Format

- A JSON array of objects
- Keys follow `order_index` order
- Null/missing values are replaced with `""`
- Pretty-printed with 2-space indentation

### Notes

- Export always includes the full dataset regardless of the current search or sort state
- Fields are exported in their defined order, not the order they appear as columns after any reordering in the UI

---

## Import

### Process

1. Select a format (CSV or JSON)
2. Select an import mode: **Append** or **Replace**
3. Click "Select File to Import" — a system open dialog appears
4. A preview screen shows before any data is written:
   - Item count
   - Import mode
   - Matched fields (file columns that match existing collection fields by name, case-insensitive)
   - New fields (file columns that do not match any existing field — will be created as `text` type)
   - Sample data (first 3 rows)
5. Click "Import N items" to execute

### Import Modes

| Mode      | Behavior                                                                 |
|-----------|--------------------------------------------------------------------------|
| `append`  | Existing items are kept; imported items are added after them             |
| `replace` | All existing items are deleted first; then imported items are inserted   |

Replace mode does **not** delete existing fields, only items.

### Field Handling

- Field matching is case-insensitive
- New fields are created as `text` type with auto-assigned order indices
- If the collection has no fields at all, all file columns are treated as new fields
- Field names that fail the safety validation block the import entirely (a warning toast is shown listing the invalid names)

### CSV Parsing Details

- UTF-8 BOM is stripped from the first header automatically
- Headers and values are trimmed of leading/trailing whitespace
- Rows with fewer columns than headers have missing values filled with `""`
- Empty rows are included as items with all-empty values
- Commas inside quoted values are handled correctly

### JSON Parsing Details

- Input must be a JSON array; a plain object or other type throws a parse error
- An empty array `[]` is valid and results in zero items being imported
- Field names are derived from the keys of the first object in the array

### Atomicity

The entire import (field creation + item insertion/deletion) is executed as a single database transaction. If any part fails, the database is left unchanged.

### Constraints

- Both new fields and items in the import payload must reference the same `collectionId`; a mismatch is rejected before the transaction begins
- Item data values are validated (string, finite number, or null only)
- After import, fields and items are reloaded from the database to reflect the new state
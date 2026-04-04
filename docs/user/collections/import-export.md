# Import & Export

Collection-level import and export lives in `Collection Settings`.

## Open Collection Import or Export

1. Open the collection.
2. Click `Collection Settings` in the top bar.
3. Use the `Export Data` or `Import Data` section.

## Export a Collection

Second Brain exports collection data as CSV or JSON.

### CSV Export

- Exports all items in the collection.
- Values are quoted for compatibility.
- Best for spreadsheets and one-way data transfer.

### JSON Export

- Exports all items as JSON.
- Optional `Include schema` wraps the items with field types and field options.
- Use `Include schema` when you want a more reliable round-trip back into Second Brain.

## Import into a Collection

Imports support CSV and JSON.

### Import Modes

- `Append`: keep existing items and add imported ones.
- `Replace`: delete existing items in the collection and replace them with the imported set.

### Import Preview

Before the import runs, the preview shows:

- Total items to import.
- Matched fields.
- New fields that will be created.
- Suggested field types for new fields.
- Choices preview for select and multiselect fields.
- Sample data from the first imported items.

If the collection has no fields yet, the import flow can create them from the preview selections.

## Field Inference and Overrides

When new fields are detected:

- The app suggests a field type.
- You can change the suggested type before importing.
- For select and multiselect, the preview can derive choices from the imported data.

## Full Database Export and Restore

Collection import/export is not the same as full-database recovery.

- Collection-level import/export belongs in `Collection Settings`.
- Full archive export and restore belongs in global [Settings & Recovery](../settings-recovery).

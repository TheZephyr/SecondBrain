# Navigation

This page explains the main parts of the interface and when to use each one.

## Sidebar

The left sidebar is the main navigation surface.

- `Dashboard`: returns to the collection overview.
- `Collections`: lists every collection in the database.
- `New Collection`: opens the `Create New Collection` dialog.
- `Settings`: opens the global settings screen.

## Collection Tree

When you expand a collection in the sidebar, you see its views.

- The locked view is the default source view for the collection.
- Child views appear below it and can be opened, renamed, deleted, and reordered.
- Click `Add view` to create a new grid, kanban, or calendar child view.
- Expanding a different collection also opens that collection in the main workspace.
- Clicking a collection that is already open keeps the current workspace in place instead of reloading it.

When creating a child view:

- `Kanban` asks for a `Stacked by` select field.
- `Calendar` asks for a `Date field`.
- `Grid` does not require an extra field choice.

## Top Bar Inside a Collection

When a collection is open, the content navbar shows:

- A breadcrumb with the collection name, active view, and active section.
- A `Data` tab.
- A `Fields` tab.
- A `Collection Settings` toggle.

Use them like this:

- `Data`: work with rows, cards, or calendar entries.
- `Fields`: manage the base field list or, in child views, configure visible fields and grouping/date selection.
- `Collection Settings`: rename the collection, export data, import data, or delete the collection.

## Global Settings vs Collection Settings

These are different screens with different responsibilities.

### Global `Settings`

Open from the sidebar. Use it for:

- Backup retention settings.
- Manual backups.
- Full archive export.
- Full archive preview and restore.

### `Collection Settings`

Open from the top bar while a collection is active. Use it for:

- Renaming the collection.
- Exporting that collection as CSV or JSON.
- Importing into that collection with preview.
- Deleting the collection.

## Dashboard

The dashboard shows one card per collection.

- Each card displays the collection name and current item count.
- Click a card to open that collection.

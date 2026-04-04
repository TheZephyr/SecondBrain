# Collections

A collection is the top-level container for one kind of data, such as tasks, books, habits, or contacts.

## What a Collection Contains

Each collection includes:

- A name.
- A set of fields that define the schema.
- Items stored as rows of data.
- One default source view.
- Optional child views for alternate layouts.

## Create a Collection

1. Click `New Collection` in the sidebar.
2. Enter the collection name.
3. Click `Create Collection`.

## Open a Collection

1. Expand the collection in the sidebar if needed.
2. Click one of its views.

Opening a collection loads its fields, items, and views into the workspace.

## Rename a Collection

1. Open the collection.
2. Click `Collection Settings` in the top bar.
3. Open the `Collection Settings` accordion section.
4. Change `Collection Name`.
5. Click `Save Changes`.

## Delete a Collection

1. Open the collection.
2. Click `Collection Settings`.
3. Open the `Danger Zone` section.
4. Click `Delete Collection`.
5. Confirm the action.

Deleting a collection removes the collection, its fields, its items, and its views.

## Default Source View vs Child Views

Every collection has one locked source view and can have additional child views.

- The source view reflects the collection's base field order.
- Child views can have their own visible field selection and per-view layout configuration.
- Reordering or deleting fields in the collection can affect child view configuration.

## Local Data Storage

Collection data is stored locally in the app database. Export and backup tools are available, but normal collection work happens directly against the local database.

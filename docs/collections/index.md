# Collections

## Overview

A collection is the top-level organizational unit in Second Brain. Each collection is an independent dataset with its own schema (fields), items (rows), and views. Collections are analogous to a table or a database, but with a flexible, user-defined structure.

## Creating a Collection

Collections are created from the sidebar via the "New Collection" button. A name is required (1–80 characters). The name is validated before saving and a toast notification is shown if it is invalid.

When a collection is created, a default **Grid** view is automatically provisioned for it.

## Selecting a Collection

Clicking a collection in the sidebar:
- Expands the collection in the sidebar to show its views
- Navigates to the collection's active view
- Resets all transient state: search query, item list, active panel, settings panel

## Renaming a Collection

Collection names can be changed from the Collection Settings panel (accessible via the "Collection Settings" button in the top navbar). Changes are validated with the same rules as creation.

## Deleting a Collection

Deletion is available in the Danger Zone section of Collection Settings. It requires confirmation via a dialog. Deleting a collection permanently removes all of its fields, items, and views. There is no undo.

If the deleted collection was the currently active one, the app navigates back to the Dashboard.

## Dashboard

The Dashboard shows a card for every collection. Each card displays the collection name and its current item count. Clicking a card navigates into that collection.

## Data Storage

Collections are stored in a local SQLite database at `%APPDATA%/second-brain/secondbrain.db` on Windows. All data is local — nothing is transmitted externally.

## Constraints

- Collection names: 1–80 characters, trimmed
- There is no limit on the number of collections
- Collections cannot be nested or grouped
# Second Brain User Guide

Second Brain is a local-first desktop app for organizing structured personal data in custom collections. Each collection stores items in SQLite and can be viewed as a grid, kanban board, or calendar, depending on the fields you define.

## What You Can Do

- Create collections for different kinds of data.
- Define fields with types such as text, date, select, multiselect, URL, and rating.
- Add, edit, search, sort, and reorganize items.
- Create child views with their own visible fields and layout settings.
- Import or export collection data as CSV or JSON.
- Create backups and full-database archives for recovery or migration.

## Recommended Reading Order

1. [Getting Started](./getting-started)
2. [Navigation](./navigation)
3. [Collections](./collections/)
4. [Fields](./collections/fields)
5. [Items](./collections/items)
6. [Views](./collections/views)
7. [Import & Export](./collections/import-export)
8. [Settings & Recovery](./settings-recovery)

## Important Product Boundaries

- All data stays on your machine. Second Brain stores app data in a local SQLite database.
- The app has two settings scopes:
  - Global `Settings` in the sidebar for backups and full-database archive tools.
  - `Collection Settings` inside an open collection for collection-specific import, export, rename, and delete actions.
- Grid, kanban, and calendar behavior depends on your field setup. Some actions are only available when the required field types exist.

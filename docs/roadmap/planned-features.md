# Planned Features

This page tracks features that are stubbed, partially built, or explicitly intended for future development based on the current codebase.

---

## Kanban View

**Status:** View type is registered and creatable. Renders "coming soon."

**Intended design:**
- Card-based board layout
- Columns correspond to values of a chosen `select` field
- Cards represent items; dragging a card between columns updates that field's value
- A collection needs at least one `select` field to make meaningful use of this view
- Column widths and card field visibility would likely be stored in the view config

---

## Calendar View

**Status:** View type is registered and creatable. Renders "coming soon."

**Intended design:**
- Monthly or weekly calendar layout
- Events/items are placed on dates based on a chosen `date` field
- Clicking a date or event opens the item editor
- A collection needs at least one `date` field to make meaningful use of this view

---

## Filter

**Status:** "Filter" button exists in the grid toolbar but is non-functional (no click handler, no UI).

**Intended design:**
- One or more filter conditions per view, each targeting a specific field
- Conditions would be sent to the database as part of the `getItems` query
- Filter state would likely be persisted in view config alongside sort state
- Possible condition types: equals, contains, is empty, before/after (for dates), greater/less than (for numbers)

---

## Settings Page

**Status:** `src/components/views/Settings.vue` exists as an empty file.

**Intended design:** Unknown. Likely a global preferences panel (theme, default view type, etc.).

---

## Bulk Select & Bulk Actions in the Grid

**Status:** The database layer fully supports `bulkDeleteItems` and `bulkPatchItems`. Row checkboxes are rendered and toggle local selection state in the grid body. However, there is no bulk action toolbar and the selection state is local to `CollectionGridBody` — it is not surfaced to the store or any action handler.

**Intended design:**
- Selecting one or more rows via checkboxes reveals a bulk action toolbar
- Actions: bulk delete (with confirmation), bulk patch (e.g. set a field value across all selected rows)
- The IPC layer and DB worker are already implemented and tested; only the UI wiring is missing

---

## Sort Modal / Sort Management UI

**Status:** The "Sort" button in the grid toolbar is styled as active when a sort is applied but has no click handler. Multi-sort is fully functional via column header shift-clicks.

**Intended design:** A dropdown or modal panel listing active sort conditions, with the ability to remove individual sort levels, change direction, or reorder sort priority without using column headers.

---

## Schema Migrations (Ongoing)

The database uses `PRAGMA user_version` to track schema version. Three migrations have been applied so far:

| Version | Change                                      |
|---------|---------------------------------------------|
| 1       | Added `views` table; backfilled default Grid view for all existing collections |
| 2       | Added `order` column to `items`; backfilled from `rowid` |
| 3       | Added `config` column to `views`            |

Future schema changes must follow the same incremental migration pattern. Deleting the database to resolve schema conflicts is explicitly not acceptable — the app is local-first and data loss is unacceptable.
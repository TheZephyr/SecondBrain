# Fields

Fields define the shape of a collection. Every item uses the same field list.

## Where to Manage Fields

Open a collection and click `Fields` in the top bar.

- In the default source view, `Fields` manages the collection's actual field list.
- In a child view, `Fields` manages `Visible Fields` and the view-specific grouping or date field.
- Both screens now use draft editing with `Save changes` and `Reset`.

## Supported Field Types

Second Brain supports these field types:

- `text`: short text values.
- `longtext`: larger freeform text.
- `number`: numeric values.
- `date`: calendar dates.
- `select`: one choice from a predefined list.
- `multiselect`: multiple choices from a predefined list.
- `boolean`: true/false values rendered with an icon.
- `url`: text values that can be opened as links.
- `rating`: numeric ratings with configurable icon, color, and range.

## Field Options

Depending on type, a field can include options such as:

- Default values.
- Field `description`.
- `uniqueCheck` duplicate warnings.
- Select or multiselect `choices`.
- Select or multiselect option colors.
- Date format and optional highlight rule, including `current` for today-relative highlighting.
- Boolean icon style.
- Rating icon, color, minimum, maximum, and default value.
- Long text `richText` flag.
- Number formatting, chip display, and color scale settings.

`uniqueCheck` is a UI warning system, not a database uniqueness constraint. Duplicate values are highlighted so you can spot collisions while editing.

## Add a Field

1. Open the collection's default source view.
2. Click `Fields` in the top bar.
3. Click `New field`.
4. Select the new row in the left column.
5. Enter the field name, choose the type, configure options, and click `Save changes`.

The new field becomes part of the collection schema and is available in all views.

## Edit a Field

1. Open `Fields` in the default source view.
2. Use the left column to search or select a field.
3. Edit its name, description, or options in the right column.
4. Click `Save changes`.

If you remove select or multiselect choices that are already used by items, the app warns you and clears those values from affected items after confirmation.

## Reorder Fields

Fields can be reordered from the source-view `Fields` screen.

- The order you set there becomes the base field order for the collection.
- Dragging is available from the left field list when search is empty.
- Child views can then choose a subset of those fields and reorder only the visible selection for that child view.

## Delete a Field

1. Open `Fields` in the default source view.
2. Select the field.
3. Use `Delete field` in the right panel.
3. Confirm the deletion.

Deleting a field removes that column's data from every item in the collection.

## Child View Field Controls

When a child view is active, the `Fields` tab switches to view-specific controls.

- `Visible Fields`: choose which source fields appear in that child view.
- Drag selected fields to reorder them within the child view.
- `Kanban`: choose the select field used to stack items into columns and the `Card title` field shown as the larger first line on each card.
- `Calendar`: choose the date field used to place items on the calendar.
- Save or discard view-specific field changes with `Save changes` and `Reset`.

If the field used by a child view is later deleted, the view remains but must be reconfigured.

## Descriptions

- Field descriptions can be edited from field settings.
- In grid view, a field with a description shows an `i` hint in the column header.
- Descriptions also appear next to field labels in item editing and other field-setting surfaces.

## Type-Specific Notes

- `longtext`: `Enable rich text` is stored now and reserved for future markdown formatting behavior.
- `number`: `Show as chip` changes presentation only. Sorting, filtering, and search still use the numeric value. `Show thousands separator` uses spaces. `Color scale` is recalculated from the collection's values for that field.
- `date`: highlight rules can target `current`, which compares against the user's local current date.
- `select` / `multiselect`: option colors can be chosen from the built-in palette or set manually with a color picker / hex value.
- `rating`: interactive rating fields are click-to-set across editable views, with hover preview and click-again to clear. You can keep one default color or assign per-value colors with the same palette/manual picker flow used by select options.

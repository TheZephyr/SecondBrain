# Fields

Fields define the shape of a collection. Every item uses the same field list.

## Where to Manage Fields

Open a collection and click `Fields` in the top bar.

- In the default source view, `Fields` manages the collection's actual field list.
- In a child view, `Fields` manages `Visible Fields` and the view-specific grouping or date field.

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
- `uniqueCheck` duplicate warnings.
- Select or multiselect `choices`.
- Date format and optional highlight rule.
- Boolean icon style.
- Rating icon, color, minimum, maximum, and default value.
- Long text `richText` flag.

`uniqueCheck` is a UI warning system, not a database uniqueness constraint. Duplicate values are highlighted so you can spot collisions while editing.

## Add a Field

1. Open the collection's default source view.
2. Click `Fields` in the top bar.
3. Use the add-field form at the bottom of the page.
4. Enter the field name, choose the type, configure options, and save.

The new field becomes part of the collection schema and is available in all views.

## Edit a Field

1. Open `Fields` in the default source view.
2. Expand the field you want to change.
3. Update its name or options.
4. Save the changes.

If you remove select or multiselect choices that are already used by items, the app warns you and clears those values from affected items after confirmation.

## Reorder Fields

Fields can be reordered from the source-view `Fields` screen.

- The order you set there becomes the base field order for the collection.
- Child views can then choose a subset of those fields and reorder only the visible selection for that child view.

## Delete a Field

1. Open `Fields` in the default source view.
2. Choose the delete action for the field.
3. Confirm the deletion.

Deleting a field removes that column's data from every item in the collection.

## Child View Field Controls

When a child view is active, the `Fields` tab switches to view-specific controls.

- `Visible Fields`: choose which source fields appear in that child view.
- Drag selected fields to reorder them within the child view.
- `Kanban`: choose the select field used to stack items into columns.
- `Calendar`: choose the date field used to place items on the calendar.

If the field used by a child view is later deleted, the view remains but must be reconfigured.

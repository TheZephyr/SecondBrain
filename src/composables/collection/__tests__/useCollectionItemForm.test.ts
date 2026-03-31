import { describe, expect, it, vi } from "vitest";
import { nextTick, ref } from "vue";
import type { Field, Item } from "../../../types/models";
import {
  buildItemDataFromForm,
  buildItemFormDataFromItem,
  createDefaultItemFormData,
  useCollectionItemForm,
} from "../useCollectionItemForm";

function makeField(input: Partial<Field> & Pick<Field, "id" | "name">): Field {
  return {
    id: input.id,
    collection_id: 1,
    name: input.name,
    type: input.type ?? "text",
    options: input.options ?? null,
    order_index: input.order_index ?? 0,
  };
}

function makeItem(data: Record<string, unknown> = {}): Item {
  return { id: 1, collection_id: 1, order: 1, data: data as Item["data"] };
}

// ---------------------------------------------------------------------------
// createDefaultItemFormData
// ---------------------------------------------------------------------------

describe("createDefaultItemFormData", () => {
  it("creates default form data by field type", () => {
    const fields: Field[] = [
      makeField({ id: 1, name: "Title", type: "text" }),
      makeField({ id: 2, name: "Published", type: "date" }),
      makeField({ id: 3, name: "Rating", type: "number" }),
    ];

    const form = createDefaultItemFormData(fields);
    expect(form.Title).toBe("");
    expect(form.Published).toBeNull();
    expect(form.Rating).toBe("");
  });

  it("applies default values from field options", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 2, 16));

    const fields: Field[] = [
      makeField({
        id: 1,
        name: "Title",
        type: "text",
        options: JSON.stringify({ defaultValue: "Hello" }),
      }),
      makeField({
        id: 2,
        name: "Due",
        type: "date",
        options: JSON.stringify({ defaultValue: "current" }),
      }),
      makeField({
        id: 3,
        name: "Status",
        type: "select",
        options: JSON.stringify({
          choices: ["Open", "Done"],
          defaultValue: "Done",
        }),
      }),
    ];

    const form = createDefaultItemFormData(fields);
    expect(form.Title).toBe("Hello");
    const due = form.Due as Date;
    expect(due instanceof Date).toBe(true);
    expect(due.getFullYear()).toBe(2026);
    expect(due.getMonth()).toBe(2);
    expect(due.getDate()).toBe(16);
    expect(form.Status).toBe("Done");

    vi.useRealTimers();
  });

  it("applies typed defaults for number, rating, multiselect, and boolean fields", () => {
    const fields: Field[] = [
      makeField({
        id: 1,
        name: "Count",
        type: "number",
        options: JSON.stringify({ defaultValue: 12 }),
      }),
      makeField({
        id: 2,
        name: "Stars",
        type: "rating",
        options: JSON.stringify({ defaultValue: 4 }),
      }),
      makeField({
        id: 3,
        name: "Tags",
        type: "multiselect",
        options: JSON.stringify({ defaultValue: ["A", "B"] }),
      }),
      makeField({ id: 4, name: "Done", type: "boolean" }),
    ];

    const form = createDefaultItemFormData(fields);

    expect(form.Count).toBe(12);
    expect(form.Stars).toBe(4);
    expect(form.Tags).toBe('["A","B"]');
    expect(form.Done).toBe("0");
  });
});

// ---------------------------------------------------------------------------
// buildItemFormDataFromItem
// ---------------------------------------------------------------------------

describe("buildItemFormDataFromItem", () => {
  it("maps item data to form data and back with date conversion", () => {
    const fields: Field[] = [
      makeField({ id: 1, name: "Title", type: "text" }),
      makeField({ id: 2, name: "Published", type: "date" }),
      makeField({ id: 3, name: "Rating", type: "number" }),
      makeField({ id: 4, name: "Status", type: "select" }),
    ];

    const item: Item = {
      id: 42,
      collection_id: 1,
      order: 1,
      data: {
        Title: "Dune",
        Published: "2025-01-15",
        Rating: 9,
        Status: "Read",
      },
    };

    const formData = buildItemFormDataFromItem(item, fields);
    const published = formData.Published;
    expect(published instanceof Date).toBe(true);
    if (published instanceof Date) {
      expect(published.getFullYear()).toBe(2025);
      expect(published.getMonth()).toBe(0);
      expect(published.getDate()).toBe(15);
    }

    formData.Published = new Date(2026, 1, 5);
    const serialized = buildItemDataFromForm(formData, fields);
    expect(serialized).toEqual({
      Title: "Dune",
      Published: "2026-02-05",
      Rating: 9,
      Status: "Read",
    });
  });

  it("coerces stored number strings to numbers for number fields", () => {
    const fields = [makeField({ id: 1, name: "Score", type: "number" })];
    const data = buildItemFormDataFromItem(makeItem({ Score: "42" }), fields);
    expect(data.Score).toBe(42);
  });

  it("leaves empty string as-is for number fields", () => {
    const fields = [makeField({ id: 1, name: "Score", type: "number" })];
    const data = buildItemFormDataFromItem(makeItem({ Score: "" }), fields);
    expect(data.Score).toBe("");
  });

  it("leaves null as-is for number fields", () => {
    const fields = [makeField({ id: 1, name: "Score", type: "number" })];
    const data = buildItemFormDataFromItem(makeItem({ Score: null }), fields);
    expect(data.Score).toBe("");
  });

  it("falls back to empty string for missing text fields", () => {
    const fields = [makeField({ id: 1, name: "Title", type: "text" })];
    const data = buildItemFormDataFromItem(makeItem({}), fields);
    expect(data.Title).toBe("");
  });

  it("handles null date fields by keeping null", () => {
    const fields = [makeField({ id: 1, name: "Due", type: "date" })];
    const data = buildItemFormDataFromItem(makeItem({ Due: null }), fields);
    expect(data.Due).toBeNull();
  });

  it("converts rating, multiselect, boolean, and select values from item data", () => {
    const fields: Field[] = [
      makeField({ id: 1, name: "Stars", type: "rating" }),
      makeField({ id: 2, name: "Tags", type: "multiselect" }),
      makeField({ id: 3, name: "Done", type: "boolean" }),
      makeField({ id: 4, name: "Status", type: "select" }),
    ];

    const data = buildItemFormDataFromItem(
      makeItem({
        Stars: "4",
        Tags: '["A","B"]',
        Done: 1,
        Status: null,
      }),
      fields,
    );

    expect(data.Stars).toBe(4);
    expect(data.Tags).toBe('["A","B"]');
    expect(data.Done).toBe("1");
    expect(data.Status).toBeNull();
  });

  it("maps invalid number strings back to empty string", () => {
    const fields = [makeField({ id: 1, name: "Score", type: "number" })];
    const data = buildItemFormDataFromItem(makeItem({ Score: "abc" }), fields);
    expect(data.Score).toBe("");
  });
});

// ---------------------------------------------------------------------------
// buildItemDataFromForm
// ---------------------------------------------------------------------------

describe("buildItemDataFromForm", () => {
  it("serialises a Date object to ISO date string for date fields", () => {
    const fields = [makeField({ id: 1, name: "Due", type: "date" })];
    const result = buildItemDataFromForm(
      { Due: new Date(2025, 5, 15) },
      fields,
    );
    expect(result.Due).toBe("2025-06-15");
  });

  it("serialises null date as empty string", () => {
    const fields = [makeField({ id: 1, name: "Due", type: "date" })];
    const result = buildItemDataFromForm({ Due: null }, fields);
    expect(result.Due).toBe("");
  });

  it("converts null/undefined text values to empty string", () => {
    const fields = [makeField({ id: 1, name: "Title", type: "text" })];
    expect(buildItemDataFromForm({ Title: null }, fields).Title).toBe("");
    expect(
      buildItemDataFromForm({ Title: undefined as unknown as null }, fields)
        .Title,
    ).toBe("");
  });

  it("serialises number, rating, multiselect, boolean, and select values", () => {
    const fields: Field[] = [
      makeField({ id: 1, name: "Count", type: "number" }),
      makeField({ id: 2, name: "Stars", type: "rating" }),
      makeField({ id: 3, name: "Tags", type: "multiselect" }),
      makeField({ id: 4, name: "Done", type: "boolean" }),
      makeField({ id: 5, name: "Status", type: "select" }),
    ];

    const result = buildItemDataFromForm(
      {
        Count: "12",
        Stars: 4,
        Tags: '["A","B"]',
        Done: "1",
        Status: "",
      },
      fields,
    );

    expect(result.Count).toBe(12);
    expect(result.Stars).toBe(4);
    expect(result.Tags).toBe('["A","B"]');
    expect(result.Done).toBe("1");
    expect(result.Status).toBeNull();
  });

  it("normalises empty number and multiselect values", () => {
    const fields: Field[] = [
      makeField({ id: 1, name: "Count", type: "number" }),
      makeField({ id: 2, name: "Tags", type: "multiselect" }),
    ];

    const result = buildItemDataFromForm(
      { Count: "", Tags: null },
      fields,
    );

    expect(result.Count).toBe("");
    expect(result.Tags).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// useCollectionItemForm - composable API surface
// ---------------------------------------------------------------------------

describe("useCollectionItemForm", () => {
  it("supports create/edit flows through the composable API", () => {
    const fields = ref<Field[]>([
      makeField({ id: 1, name: "Title", type: "text" }),
      makeField({ id: 2, name: "Published", type: "date" }),
    ]);

    const item: Item = {
      id: 7,
      collection_id: 1,
      order: 1,
      data: { Title: "Neuromancer", Published: "2024-08-11" },
    };

    const form = useCollectionItemForm(fields);

    form.startEdit(item);
    expect(form.isEditing.value).toBe(true);
    expect(form.getTextValue("Title")).toBe("Neuromancer");
    expect(form.getDateValue("Published") instanceof Date).toBe(true);

    form.startCreate();
    expect(form.isEditing.value).toBe(false);
    expect(form.getTextValue("Title")).toBe("");
    expect(form.getDateValue("Published")).toBeNull();
  });

  it("cancelForm clears editingItem and resets form data", () => {
    const fields = ref([makeField({ id: 1, name: "Title" })]);
    const form = useCollectionItemForm(fields);
    form.startEdit(makeItem({ Title: "Something" }));
    expect(form.isEditing.value).toBe(true);

    form.cancelForm();

    expect(form.isEditing.value).toBe(false);
    expect(form.getTextValue("Title")).toBe("");
  });

  it("resetFormData rebuilds defaults from current fields", () => {
    const fields = ref([
      makeField({ id: 1, name: "Title" }),
      makeField({ id: 2, name: "Due", type: "date" }),
    ]);
    const form = useCollectionItemForm(fields);
    form.formData.value.Title = "dirty";
    form.formData.value.Due = new Date();

    form.resetFormData();

    expect(form.getTextValue("Title")).toBe("");
    expect(form.getDateValue("Due")).toBeNull();
  });

  it("resetFormData pre-fills text defaults", () => {
    const fields = ref([
      makeField({
        id: 1,
        name: "Title",
        options: JSON.stringify({ defaultValue: "Preset" }),
      }),
    ]);
    const form = useCollectionItemForm(fields);
    form.formData.value.Title = "dirty";

    form.resetFormData();

    expect(form.getTextValue("Title")).toBe("Preset");
  });

  it("resetFormData applies current date defaults", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 2, 16));

    const fields = ref([
      makeField({
        id: 1,
        name: "Due",
        type: "date",
        options: JSON.stringify({ defaultValue: "current" }),
      }),
    ]);
    const form = useCollectionItemForm(fields);
    form.formData.value.Due = new Date(2025, 0, 1);

    form.resetFormData();

    const due = form.getDateValue("Due");
    expect(due instanceof Date).toBe(true);
    if (due) {
      expect(due.getFullYear()).toBe(2026);
      expect(due.getMonth()).toBe(2);
      expect(due.getDate()).toBe(16);
    }

    vi.useRealTimers();
  });

  it("toItemData serialises current form data using the fields list", () => {
    const fields = ref([
      makeField({ id: 1, name: "Title" }),
      makeField({ id: 2, name: "Due", type: "date" }),
    ]);
    const form = useCollectionItemForm(fields);
    form.setTextValue("Title", "My Book");
    form.setDateValue("Due", new Date(2025, 11, 31));

    const result = form.toItemData();

    expect(result.Title).toBe("My Book");
    expect(result.Due).toBe("2025-12-31");
  });

  it("getFieldInputId returns a stable id string from field.id", () => {
    const fields = ref([makeField({ id: 7, name: "Title" })]);
    const form = useCollectionItemForm(fields);
    expect(form.getFieldInputId(fields.value[0])).toBe("field-input-7");
  });

  // --- getTextValue / setTextValue ---

  it("getTextValue converts numbers to string", () => {
    const fields = ref([makeField({ id: 1, name: "Score", type: "number" })]);
    const form = useCollectionItemForm(fields);
    form.formData.value.Score = 99;
    expect(form.getTextValue("Score")).toBe("99");
  });

  it("setTextValue stores the value; undefined becomes empty string", () => {
    const fields = ref([makeField({ id: 1, name: "Title" })]);
    const form = useCollectionItemForm(fields);
    form.setTextValue("Title", "Hello");
    expect(form.getTextValue("Title")).toBe("Hello");
    form.setTextValue("Title", undefined);
    expect(form.getTextValue("Title")).toBe("");
  });

  // --- getSelectValue / setSelectValue ---

  it("getSelectValue returns empty string for null/undefined", () => {
    const fields = ref([makeField({ id: 1, name: "Status", type: "select" })]);
    const form = useCollectionItemForm(fields);
    form.formData.value.Status = null;
    expect(form.getSelectValue("Status")).toBe("");
    form.formData.value.Status = undefined as unknown as null;
    expect(form.getSelectValue("Status")).toBe("");
  });

  it("getSelectValue stringifies non-string values", () => {
    const fields = ref([makeField({ id: 1, name: "Status", type: "select" })]);
    const form = useCollectionItemForm(fields);
    form.formData.value.Status = 123 as unknown as string;
    expect(form.getSelectValue("Status")).toBe("123");
  });

  it("setSelectValue stores the value; undefined becomes empty string", () => {
    const fields = ref([makeField({ id: 1, name: "Status", type: "select" })]);
    const form = useCollectionItemForm(fields);
    form.setSelectValue("Status", "Active");
    expect(form.getSelectValue("Status")).toBe("Active");
    form.setSelectValue("Status", undefined);
    expect(form.getSelectValue("Status")).toBe("");
  });

  it("getSelectOptions returns empty array when options is null", () => {
    const fields = ref([
      makeField({ id: 1, name: "Status", type: "select", options: null }),
    ]);
    const form = useCollectionItemForm(fields);
    expect(form.getSelectOptions(fields.value[0])).toEqual([]);
  });

  it("getSelectOptions reads choices from JSON options", () => {
    const fields = ref([
      makeField({
        id: 1,
        name: "Status",
        type: "select",
        options: JSON.stringify({ choices: ["Active", "Inactive", "Done"] }),
      }),
    ]);
    const form = useCollectionItemForm(fields);
    expect(form.getSelectOptions(fields.value[0])).toEqual([
      "Active",
      "Inactive",
      "Done",
    ]);
  });

  // --- getNumberValue / setNumberValue ---

  it("getNumberValue returns null for empty/null/undefined", () => {
    const fields = ref([makeField({ id: 1, name: "N", type: "number" })]);
    const form = useCollectionItemForm(fields);
    form.formData.value.N = "";
    expect(form.getNumberValue("N")).toBeNull();
    form.formData.value.N = null;
    expect(form.getNumberValue("N")).toBeNull();
    form.formData.value.N = undefined as unknown as null;
    expect(form.getNumberValue("N")).toBeNull();
  });

  it("getNumberValue returns null for non-finite numbers", () => {
    const fields = ref([makeField({ id: 1, name: "N", type: "number" })]);
    const form = useCollectionItemForm(fields);
    form.formData.value.N = Infinity;
    expect(form.getNumberValue("N")).toBeNull();
  });

  it("getNumberValue parses a numeric string", () => {
    const fields = ref([makeField({ id: 1, name: "N", type: "number" })]);
    const form = useCollectionItemForm(fields);
    form.formData.value.N = "3.14";
    expect(form.getNumberValue("N")).toBeCloseTo(3.14);
  });

  it("getNumberValue returns null for a non-numeric string", () => {
    const fields = ref([makeField({ id: 1, name: "N", type: "number" })]);
    const form = useCollectionItemForm(fields);
    form.formData.value.N = "abc";
    expect(form.getNumberValue("N")).toBeNull();
  });

  it("setNumberValue stores the value; undefined/null becomes empty string", () => {
    const fields = ref([makeField({ id: 1, name: "N", type: "number" })]);
    const form = useCollectionItemForm(fields);
    form.setNumberValue("N", 42);
    expect(form.getNumberValue("N")).toBe(42);
    form.setNumberValue("N", null);
    expect(form.formData.value.N).toBe("");
    form.setNumberValue("N", undefined);
    expect(form.formData.value.N).toBe("");
  });

  // --- getDateValue / setDateValue ---

  it("getDateValue returns null for empty/null/undefined", () => {
    const fields = ref([makeField({ id: 1, name: "Due", type: "date" })]);
    const form = useCollectionItemForm(fields);
    form.formData.value.Due = "";
    expect(form.getDateValue("Due")).toBeNull();
    form.formData.value.Due = null;
    expect(form.getDateValue("Due")).toBeNull();
    form.formData.value.Due = undefined as unknown as null;
    expect(form.getDateValue("Due")).toBeNull();
  });

  it("getDateValue passes through an existing Date object", () => {
    const fields = ref([makeField({ id: 1, name: "Due", type: "date" })]);
    const form = useCollectionItemForm(fields);
    const d = new Date(2025, 0, 1);
    form.formData.value.Due = d;
    expect(form.getDateValue("Due")).toBe(d);
  });

  it("getDateValue parses a date string", () => {
    const fields = ref([makeField({ id: 1, name: "Due", type: "date" })]);
    const form = useCollectionItemForm(fields);
    form.formData.value.Due = "2025-03-20";
    const result = form.getDateValue("Due");
    expect(result instanceof Date).toBe(true);
    expect((result as Date).getFullYear()).toBe(2025);
  });

  it("setDateValue stores a Date object directly", () => {
    const fields = ref([makeField({ id: 1, name: "Due", type: "date" })]);
    const form = useCollectionItemForm(fields);
    const d = new Date(2026, 2, 10);
    form.setDateValue("Due", d);
    expect(form.formData.value.Due).toBe(d);
  });

  it("setDateValue sets null for non-Date values", () => {
    const fields = ref([makeField({ id: 1, name: "Due", type: "date" })]);
    const form = useCollectionItemForm(fields);
    form.setDateValue("Due", null);
    expect(form.formData.value.Due).toBeNull();
    form.setDateValue("Due", undefined);
    expect(form.formData.value.Due).toBeNull();
  });

  // --- getRatingValue / setRatingValue ---

  it("getRatingValue/setRatingValue round-trip rating values", () => {
    const fields = ref([makeField({ id: 1, name: "Stars", type: "rating" })]);
    const form = useCollectionItemForm(fields);

    form.setRatingValue("Stars", 4);
    expect(form.formData.value.Stars).toBe(4);
    expect(form.getRatingValue("Stars")).toBe(4);

    form.setRatingValue("Stars", null);
    expect(form.formData.value.Stars).toBeNull();
    expect(form.getRatingValue("Stars")).toBeNull();
  });

  it("getBooleanValue parses stored string values", () => {
    const fields = ref([makeField({ id: 1, name: "Done", type: "boolean" })]);
    const form = useCollectionItemForm(fields);

    form.formData.value.Done = "1";
    expect(form.getBooleanValue("Done")).toBe(true);
    form.formData.value.Done = "0";
    expect(form.getBooleanValue("Done")).toBe(false);
  });

  it("getMultiselectValue/setMultiselectValue round-trip through JSON", () => {
    const fields = ref([
      makeField({ id: 1, name: "Tags", type: "multiselect" }),
    ]);
    const form = useCollectionItemForm(fields);
    form.setMultiselectValue("Tags", ["A", "B"]);
    expect(form.formData.value.Tags).toBe('["A","B"]');
    expect(form.getMultiselectValue("Tags")).toEqual(["A", "B"]);
  });

  it("getBooleanValue/setBooleanValue map to 1/0 strings", () => {
    const fields = ref([makeField({ id: 1, name: "Done", type: "boolean" })]);
    const form = useCollectionItemForm(fields);
    form.setBooleanValue("Done", true);
    expect(form.formData.value.Done).toBe("1");
    expect(form.getBooleanValue("Done")).toBe(true);
    form.setBooleanValue("Done", false);
    expect(form.formData.value.Done).toBe("0");
    expect(form.getBooleanValue("Done")).toBe(false);
  });

  it("initialData updates refresh form data when not editing", async () => {
    const fields = ref([
      makeField({ id: 1, name: "Title", type: "text" }),
      makeField({ id: 2, name: "Due", type: "date" }),
    ]);
    const initialData = ref({ Title: "First", Due: "2025-01-01" });
    const form = useCollectionItemForm(fields, initialData);

    expect(form.getTextValue("Title")).toBe("");

    form.startCreate();
    expect(form.getTextValue("Title")).toBe("First");

    initialData.value = { Title: "Second", Due: "2025-02-02" };
    await nextTick();

    expect(form.getTextValue("Title")).toBe("Second");
    expect(form.getDateValue("Due")?.getFullYear()).toBe(2025);
    expect(form.getDateValue("Due")?.getMonth()).toBe(1);
    expect(form.getDateValue("Due")?.getDate()).toBe(2);
  });

  it("initialData changes do not override an active edit session", async () => {
    const fields = ref([makeField({ id: 1, name: "Title", type: "text" })]);
    const initialData = ref({ Title: "Initial" });
    const form = useCollectionItemForm(fields, initialData);
    form.startEdit(makeItem({ Title: "Editing" }));

    initialData.value = { Title: "Updated" };
    await nextTick();

    expect(form.isEditing.value).toBe(true);
    expect(form.getTextValue("Title")).toBe("Editing");
  });
});

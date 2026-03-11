import { describe, expect, it } from "vitest";
import { ref } from "vue";
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
});

// ---------------------------------------------------------------------------
// useCollectionItemForm – composable API surface
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

  it("getSelectOptions splits comma-separated string and trims whitespace", () => {
    const fields = ref([
      makeField({
        id: 1,
        name: "Status",
        type: "select",
        options: "Active, Inactive , Done",
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
});

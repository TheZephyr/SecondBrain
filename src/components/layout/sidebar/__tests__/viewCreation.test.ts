import { describe, expect, it, vi } from "vitest";
import { createConfiguredView } from "../viewCreation";

describe("createConfiguredView", () => {
  it("saves the new view config and refreshes views after creation", async () => {
    const created = {
      id: 42,
      collection_id: 7,
      name: "Kanban",
      type: "kanban" as const,
      is_default: 0 as const,
      order: 1,
    };
    const store = {
      addView: vi.fn(async () => created),
      saveViewConfig: vi.fn(async () => undefined),
      loadViews: vi.fn(async () => undefined),
    };

    const result = await createConfiguredView({
      store,
      collectionId: 7,
      name: "Kanban",
      type: "kanban",
      kanbanFieldId: 11,
      selectedFieldIds: [3, 5],
    });

    expect(result).toEqual(created);
    expect(store.addView).toHaveBeenCalledWith({
      collectionId: 7,
      name: "Kanban",
      type: "kanban",
      isDefault: 0,
    });
    expect(store.saveViewConfig).toHaveBeenCalledWith(42, {
      columnWidths: {},
      sort: [],
      calendarDateField: undefined,
      calendarDateFieldId: undefined,
      groupingFieldId: 11,
      kanbanColumnOrder: undefined,
      selectedFieldIds: [3, 5],
    });
    expect(store.loadViews).toHaveBeenCalledWith(7, {
      preserveActive: true,
    });
  });

  it("does not save or refresh when creation fails", async () => {
    const store = {
      addView: vi.fn(async () => null),
      saveViewConfig: vi.fn(async () => undefined),
      loadViews: vi.fn(async () => undefined),
    };

    const result = await createConfiguredView({
      store,
      collectionId: 7,
      name: "Kanban",
      type: "kanban",
      kanbanFieldId: 11,
      selectedFieldIds: [3, 5],
    });

    expect(result).toBeNull();
    expect(store.saveViewConfig).not.toHaveBeenCalled();
    expect(store.loadViews).not.toHaveBeenCalled();
  });
});

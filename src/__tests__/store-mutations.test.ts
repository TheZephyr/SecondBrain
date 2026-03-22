import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { useStore } from "../store";
import type { IpcResult } from "../types/ipc";
import type {
  Collection,
  Field,
  Item,
  ItemData,
  PaginatedItemsResult,
  View,
  ViewConfig,
} from "../types/models";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function ok<T>(data: T): IpcResult<T> {
  return { ok: true, data };
}

function makeElectronAPIMock() {
  return {
    getCollections: vi.fn(),
    getCollectionItemCounts: vi.fn(),
    addCollection: vi.fn(),
    updateCollection: vi.fn(),
    deleteCollection: vi.fn(),
    getViews: vi.fn(),
    addView: vi.fn(),
    updateView: vi.fn(),
    deleteView: vi.fn(),
    getViewConfig: vi.fn(),
    updateViewConfig: vi.fn(),
    reorderViews: vi.fn(),
    getFields: vi.fn(),
    addField: vi.fn(),
    updateField: vi.fn(),
    reorderFields: vi.fn(),
    deleteField: vi.fn(),
    getItems: vi.fn(),
    addItem: vi.fn(),
    insertItemAt: vi.fn(),
    duplicateItem: vi.fn(),
    moveItem: vi.fn(),
    updateItem: vi.fn(),
    deleteItem: vi.fn(),
    reorderItems: vi.fn(),
    bulkDeleteItems: vi.fn(),
    bulkPatchItems: vi.fn(),
    importCollection: vi.fn(),
    showSaveDialog: vi.fn(),
    writeFile: vi.fn(),
    showOpenDialog: vi.fn(),
    readFile: vi.fn(),
    getBackupSettings: vi.fn(),
    updateBackupSettings: vi.fn(),
    listBackups: vi.fn(),
    createManualBackup: vi.fn(),
    restoreBackup: vi.fn(),
    deleteBackup: vi.fn(),
    openBackupsFolder: vi.fn(),
    openExternal: vi.fn(),
  };
}

function emptyPaginatedResult(): PaginatedItemsResult {
  return { items: [], total: 0, limit: 100, offset: 0 };
}

function makeItem(id: number, data: ItemData = {}): Item {
  return { id, collection_id: 1, order: id, data };
}

function makeView(
  id: number,
  collectionId: number,
  overrides: Partial<View> = {},
): View {
  return {
    id,
    collection_id: collectionId,
    name: `View ${id}`,
    type: "grid",
    is_default: 0,
    order: id,
    ...overrides,
  };
}

function makeField(
  id: number,
  collectionId: number,
  overrides: Partial<Field> = {},
): Field {
  return {
    id,
    collection_id: collectionId,
    name: `Field ${id}`,
    type: "text",
    options: null,
    order_index: id,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

let mockApi: ReturnType<typeof makeElectronAPIMock>;

beforeEach(() => {
  setActivePinia(createPinia());
  mockApi = makeElectronAPIMock();
  vi.stubGlobal("window", { electronAPI: mockApi });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

// ---------------------------------------------------------------------------
// Collection mutations
// ---------------------------------------------------------------------------

describe("addCollection", () => {
  it("calls IPC and reloads collections on success", async () => {
    const store = useStore();
    const created: Collection = { id: 1, name: "Books" };
    mockApi.addCollection.mockResolvedValue(ok(created));
    mockApi.getCollections.mockResolvedValue(ok([created]));

    const result = await store.addCollection({ name: "Books" });

    expect(result).toEqual(created);
    expect(mockApi.getCollections).toHaveBeenCalledOnce();
    expect(store.collections).toEqual([created]);
  });

  it("skips reload when IPC returns null", async () => {
    const store = useStore();
    mockApi.addCollection.mockResolvedValue(ok(null));

    await store.addCollection({ name: "Empty" });

    expect(mockApi.getCollections).not.toHaveBeenCalled();
  });
});

describe("updateCollection", () => {
  it("calls IPC and reloads collections on success", async () => {
    const store = useStore();
    mockApi.updateCollection.mockResolvedValue(ok(true));
    mockApi.getCollections.mockResolvedValue(
      ok([{ id: 1, name: "Updated Name" }]),
    );

    await store.updateCollection({ id: 1, name: "Updated Name" });

    expect(mockApi.updateCollection).toHaveBeenCalledWith({
      id: 1,
      name: "Updated Name",
    });
    expect(mockApi.getCollections).toHaveBeenCalledOnce();
  });

  it("skips reload when IPC returns false", async () => {
    const store = useStore();
    mockApi.updateCollection.mockResolvedValue(ok(false));

    await store.updateCollection({ id: 1, name: "Fail" });

    expect(mockApi.getCollections).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// View mutations
// ---------------------------------------------------------------------------

describe("addView", () => {
  it("creates a view, reloads views, and sets activeViewId", async () => {
    const store = useStore();
    store.selectedCollection = { id: 1, name: "Col" };
    const newView = makeView(42, 1);
    mockApi.addView.mockResolvedValue(ok(newView));
    mockApi.getViews.mockResolvedValue(ok([newView]));

    const result = await store.addView({
      collectionId: 1,
      name: "My View",
      type: "grid",
      isDefault: 0,
      order: 1,
    });

    expect(result).toEqual(newView);
    expect(store.activeViewId).toBe(42);
    expect(mockApi.getViews).toHaveBeenCalledOnce();
  });

  it("does not reload when IPC returns null", async () => {
    const store = useStore();
    mockApi.addView.mockResolvedValue(ok(null));

    await store.addView({
      collectionId: 1,
      name: "Fail",
      type: "grid",
      isDefault: 0,
      order: 1,
    });

    expect(mockApi.getViews).not.toHaveBeenCalled();
  });
});

describe("updateView", () => {
  it("returns false immediately when no selectedCollection", async () => {
    const store = useStore();
    const result = await store.updateView({ id: 5, name: "X" });
    expect(result).toBe(false);
    expect(mockApi.updateView).not.toHaveBeenCalled();
  });

  it("reloads views on success", async () => {
    const store = useStore();
    store.selectedCollection = { id: 1, name: "Col" };
    const view = makeView(5, 1);
    mockApi.updateView.mockResolvedValue(ok(true));
    mockApi.getViews.mockResolvedValue(ok([view]));

    const result = await store.updateView({ id: 5, name: "Renamed" });

    expect(result).toBe(true);
    expect(mockApi.getViews).toHaveBeenCalledOnce();
  });

  it("falls back activeViewId when the active view disappears after reload", async () => {
    const store = useStore();
    store.selectedCollection = { id: 1, name: "Col" };
    store.activeViewId = 5;
    // After reload, view 5 is gone — only view 10 remains
    const fallback = makeView(10, 1);
    mockApi.updateView.mockResolvedValue(ok(true));
    mockApi.getViews.mockResolvedValue(ok([fallback]));

    await store.updateView({ id: 5, name: "Gone" });

    expect(store.activeViewId).toBe(10);
  });
});

describe("deleteView", () => {
  it("returns false immediately when no selectedCollection", async () => {
    const store = useStore();
    const result = await store.deleteView(5);
    expect(result).toBe(false);
    expect(mockApi.deleteView).not.toHaveBeenCalled();
  });

  it("reloads views and keeps activeViewId when the deleted view was not active", async () => {
    const store = useStore();
    store.selectedCollection = { id: 1, name: "Col" };
    const kept = makeView(10, 1);
    store.activeViewId = 10;
    mockApi.deleteView.mockResolvedValue(ok(true));
    mockApi.getViews.mockResolvedValue(ok([kept]));

    await store.deleteView(5);

    expect(store.activeViewId).toBe(10);
  });

  it("falls back activeViewId when the deleted view was active", async () => {
    const store = useStore();
    store.selectedCollection = { id: 1, name: "Col" };
    const fallback = makeView(10, 1);
    store.activeViewId = 5;
    mockApi.deleteView.mockResolvedValue(ok(true));
    // View 5 is gone after reload
    mockApi.getViews.mockResolvedValue(ok([fallback]));

    await store.deleteView(5);

    expect(store.activeViewId).toBe(10);
  });
});

describe("reorderViews", () => {
  it("calls IPC and reloads views on success", async () => {
    const store = useStore();
    const view = makeView(2, 1);
    mockApi.reorderViews.mockResolvedValue(ok(true));
    mockApi.getViews.mockResolvedValue(ok([view]));

    const result = await store.reorderViews({
      collectionId: 1,
      viewOrders: [{ id: 2, order: 1 }],
    });

    expect(result).toBe(true);
    expect(mockApi.getViews).toHaveBeenCalledOnce();
  });

  it("does not reload views on failure", async () => {
    const store = useStore();
    mockApi.reorderViews.mockResolvedValue(ok(false));

    await store.reorderViews({ collectionId: 1, viewOrders: [] });

    expect(mockApi.getViews).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// loadViewConfig / saveViewConfig edge cases
// ---------------------------------------------------------------------------

describe("loadViewConfig", () => {
  it("returns null for viewId of 0", async () => {
    const store = useStore();
    const result = await store.loadViewConfig(0);
    expect(result).toBeNull();
    expect(mockApi.getViewConfig).not.toHaveBeenCalled();
  });

  it("returns null for negative viewId", async () => {
    const store = useStore();
    const result = await store.loadViewConfig(-1);
    expect(result).toBeNull();
    expect(mockApi.getViewConfig).not.toHaveBeenCalled();
  });
});

describe("saveViewConfig", () => {
  it("skips IPC for invalid viewId", async () => {
    const store = useStore();
    await store.saveViewConfig(0, {
      columnWidths: {},
      sort: [],
    });
    expect(mockApi.updateViewConfig).not.toHaveBeenCalled();
  });

  it("rounds columnWidths and enforces minimum of 60", async () => {
    const store = useStore();
    mockApi.updateViewConfig.mockResolvedValue(ok(true));

    await store.saveViewConfig(1, {
      columnWidths: { 1: 45, 2: 150.7 },
      sort: [],
    });

    const sent = mockApi.updateViewConfig.mock.calls[0][0];
    expect(sent.config.columnWidths).toEqual({ 1: 60, 2: 151 });
  });

  it("clamps sort order to 1 or -1", async () => {
    const store = useStore();
    mockApi.updateViewConfig.mockResolvedValue(ok(true));

    await store.saveViewConfig(1, {
      columnWidths: {},
      sort: [
        { field: "data.Title", order: 5 as 1 | -1 },
        { field: "data.Date", order: -1 },
      ],
    });

    const sent = mockApi.updateViewConfig.mock.calls[0][0];
    expect(sent.config.sort).toEqual([
      { field: "data.Title", order: 1 },
      { field: "data.Date", order: -1 },
    ]);
  });

  it("trims calendarDateField and drops blank strings", async () => {
    const store = useStore();
    mockApi.updateViewConfig.mockResolvedValue(ok(true));

    await store.saveViewConfig(1, {
      columnWidths: {},
      sort: [],
      calendarDateField: "  ",
    });

    const sent = mockApi.updateViewConfig.mock.calls[0][0];
    expect(sent.config.calendarDateField).toBeUndefined();
  });

  it("preserves a valid calendarDateField after trimming", async () => {
    const store = useStore();
    mockApi.updateViewConfig.mockResolvedValue(ok(true));

    await store.saveViewConfig(1, {
      columnWidths: {},
      sort: [],
      calendarDateField: "  Due Date  ",
    });

    const sent = mockApi.updateViewConfig.mock.calls[0][0];
    expect(sent.config.calendarDateField).toBe("Due Date");
  });

  it("deduplicates selectedFieldIds and drops invalid entries", async () => {
    const store = useStore();
    mockApi.updateViewConfig.mockResolvedValue(ok(true));

    await store.saveViewConfig(1, {
      columnWidths: {},
      sort: [],
      selectedFieldIds: [3, 1, 3, -1, 0, 2],
    });

    const sent = mockApi.updateViewConfig.mock.calls[0][0];
    expect(sent.config.selectedFieldIds).toEqual([3, 1, 2]);
  });
});

// ---------------------------------------------------------------------------
// Field mutations
// ---------------------------------------------------------------------------

describe("addField", () => {
  it("calls IPC and reloads fields on success", async () => {
    const store = useStore();
    const created = {
      id: 10,
      collectionId: 1,
      name: "Title",
      type: "text" as const,
      options: null,
    };
    mockApi.addField.mockResolvedValue(ok(created));
    mockApi.getFields.mockResolvedValue(ok([makeField(10, 1)]));
    mockApi.getViewConfig.mockResolvedValue(ok(null));
    // No child views — currentViews is empty by default

    await store.addField({
      collectionId: 1,
      name: "Title",
      type: "text",
      options: null,
    });

    expect(mockApi.getFields).toHaveBeenCalledWith(1);
  });

  it("does not reload when IPC returns null", async () => {
    const store = useStore();
    mockApi.addField.mockResolvedValue(ok(null));

    await store.addField({
      collectionId: 1,
      name: "Fail",
      type: "text",
      options: null,
    });

    expect(mockApi.getFields).not.toHaveBeenCalled();
  });
});

describe("updateField", () => {
  it("does nothing when no selectedCollection", async () => {
    const store = useStore();
    await store.updateField({ id: 1, name: "X", type: "text", options: null });
    expect(mockApi.updateField).not.toHaveBeenCalled();
  });

  it("reloads fields on success", async () => {
    const store = useStore();
    store.selectedCollection = { id: 1, name: "Col" };
    mockApi.updateField.mockResolvedValue(ok(true));
    mockApi.getFields.mockResolvedValue(ok([]));

    await store.updateField({
      id: 1,
      name: "Updated",
      type: "text",
      options: null,
    });

    expect(mockApi.getFields).toHaveBeenCalledWith(1);
  });
});

describe("reorderFields", () => {
  it("calls IPC and reloads fields on success", async () => {
    const store = useStore();
    mockApi.reorderFields.mockResolvedValue(ok(true));
    mockApi.getFields.mockResolvedValue(ok([]));

    await store.reorderFields({
      collectionId: 1,
      fieldOrders: [
        { id: 1, orderIndex: 0 },
        { id: 2, orderIndex: 1 },
      ],
    });

    expect(mockApi.reorderFields).toHaveBeenCalledOnce();
    expect(mockApi.getFields).toHaveBeenCalledWith(1);
  });

  it("does not reload on failure", async () => {
    const store = useStore();
    mockApi.reorderFields.mockResolvedValue(ok(false));

    await store.reorderFields({ collectionId: 1, fieldOrders: [] });

    expect(mockApi.getFields).not.toHaveBeenCalled();
  });
});

describe("deleteField", () => {
  it("does nothing when no selectedCollection", async () => {
    const store = useStore();
    await store.deleteField(1);
    expect(mockApi.deleteField).not.toHaveBeenCalled();
  });

  it("reloads fields on success", async () => {
    const store = useStore();
    store.selectedCollection = { id: 1, name: "Col" };
    mockApi.deleteField.mockResolvedValue(ok(true));
    mockApi.getFields.mockResolvedValue(ok([]));
    mockApi.getViewConfig.mockResolvedValue(ok(null));

    await store.deleteField(5);

    expect(mockApi.getFields).toHaveBeenCalledWith(1);
  });
});

// ---------------------------------------------------------------------------
// Item mutations
// ---------------------------------------------------------------------------

describe("addItem", () => {
  it("reloads items after successful add", async () => {
    const store = useStore();
    store.selectedCollection = { id: 1, name: "Col" };
    const newItem = makeItem(1, { Title: "New" });
    mockApi.addItem.mockResolvedValue(ok(newItem));
    mockApi.getItems.mockResolvedValue(
      ok<PaginatedItemsResult>({
        items: [newItem],
        total: 1,
        limit: 100,
        offset: 0,
      }),
    );

    await store.addItem({ collectionId: 1, data: { Title: "New" } });

    expect(mockApi.getItems).toHaveBeenCalled();
    expect(store.items).toEqual([newItem]);
  });

  it("reloads items using the input collectionId (no selectedCollection needed)", async () => {
    // addItem reloads via input.collectionId, not selectedCollection
    const store = useStore();
    mockApi.addItem.mockResolvedValue(ok(makeItem(1)));
    mockApi.getItems.mockResolvedValue(ok(emptyPaginatedResult()));

    await store.addItem({ collectionId: 1, data: {} });

    expect(mockApi.getItems).toHaveBeenCalled();
  });

  it("does not reload when IPC returns null", async () => {
    const store = useStore();
    store.selectedCollection = { id: 1, name: "Col" };
    mockApi.addItem.mockResolvedValue(ok(null));

    await store.addItem({ collectionId: 1, data: {} });

    expect(mockApi.getItems).not.toHaveBeenCalled();
  });
});

describe("insertItemAt", () => {
  it("reloads items after successful insert", async () => {
    const store = useStore();
    store.selectedCollection = { id: 1, name: "Col" };
    mockApi.insertItemAt.mockResolvedValue(ok(makeItem(2)));
    mockApi.getItems.mockResolvedValue(ok(emptyPaginatedResult()));

    await store.insertItemAt({ collectionId: 1, afterOrder: null });

    expect(mockApi.getItems).toHaveBeenCalled();
  });

  it("does nothing when no selectedCollection", async () => {
    const store = useStore();
    mockApi.insertItemAt.mockResolvedValue(ok(makeItem(1)));

    await store.insertItemAt({ collectionId: 1, afterOrder: null });

    expect(mockApi.getItems).not.toHaveBeenCalled();
  });
});

describe("duplicateItem", () => {
  it("reloads items after successful duplicate", async () => {
    const store = useStore();
    store.selectedCollection = { id: 1, name: "Col" };
    mockApi.duplicateItem.mockResolvedValue(ok(makeItem(3)));
    mockApi.getItems.mockResolvedValue(ok(emptyPaginatedResult()));

    await store.duplicateItem({ collectionId: 1, itemId: 1 });

    expect(mockApi.getItems).toHaveBeenCalled();
  });

  it("does nothing when no selectedCollection", async () => {
    const store = useStore();
    mockApi.duplicateItem.mockResolvedValue(ok(makeItem(3)));

    await store.duplicateItem({ collectionId: 1, itemId: 1 });

    expect(mockApi.getItems).not.toHaveBeenCalled();
  });
});

describe("moveItem", () => {
  it("reloads items after successful move", async () => {
    const store = useStore();
    store.selectedCollection = { id: 1, name: "Col" };
    mockApi.moveItem.mockResolvedValue(ok(true));
    mockApi.getItems.mockResolvedValue(ok(emptyPaginatedResult()));

    await store.moveItem({ collectionId: 1, itemId: 1, direction: "up" });

    expect(mockApi.getItems).toHaveBeenCalled();
  });

  it("does not reload items when IPC returns false", async () => {
    const store = useStore();
    store.selectedCollection = { id: 1, name: "Col" };
    mockApi.moveItem.mockResolvedValue(ok(false));

    await store.moveItem({ collectionId: 1, itemId: 1, direction: "up" });

    expect(mockApi.getItems).not.toHaveBeenCalled();
  });
});

describe("updateItem", () => {
  it("reloads items on success", async () => {
    const store = useStore();
    store.selectedCollection = { id: 1, name: "Col" };
    mockApi.updateItem.mockResolvedValue(ok(true));
    mockApi.getItems.mockResolvedValue(ok(emptyPaginatedResult()));

    await store.updateItem({ id: 1, data: { Title: "Changed" } });

    expect(mockApi.getItems).toHaveBeenCalled();
  });

  it("does nothing when no selectedCollection", async () => {
    const store = useStore();
    await store.updateItem({ id: 1, data: {} });
    expect(mockApi.updateItem).not.toHaveBeenCalled();
  });
});

describe("deleteItem", () => {
  it("reloads items on success", async () => {
    const store = useStore();
    store.selectedCollection = { id: 1, name: "Col" };
    mockApi.deleteItem.mockResolvedValue(ok(true));
    mockApi.getItems.mockResolvedValue(ok(emptyPaginatedResult()));

    await store.deleteItem(makeItem(1));

    expect(mockApi.deleteItem).toHaveBeenCalledWith(1);
    expect(mockApi.getItems).toHaveBeenCalled();
  });

  it("does nothing when no selectedCollection", async () => {
    const store = useStore();
    await store.deleteItem(makeItem(1));
    expect(mockApi.deleteItem).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// showDashboard
// ---------------------------------------------------------------------------

describe("showDashboard", () => {
  it("clears selectedCollection and sets currentView to dashboard", () => {
    const store = useStore();
    store.selectedCollection = { id: 1, name: "Col" };

    store.showDashboard();

    expect(store.selectedCollection).toBeNull();
    expect(store.currentView).toBe("dashboard");
    expect(store.fields).toEqual([]);
  });
});

describe("showSettings", () => {
  it("clears collection-scoped state and sets currentView to settings", () => {
    const store = useStore();
    store.selectedCollection = { id: 1, name: "Col" };
    store.collectionSettingsOpen = true;
    store.activeCollectionPanel = "fields";
    store.fields = [makeField(1, 1)];

    store.showSettings();

    expect(store.selectedCollection).toBeNull();
    expect(store.currentView).toBe("settings");
    expect(store.fields).toEqual([]);
    expect(store.collectionSettingsOpen).toBe(false);
    expect(store.activeCollectionPanel).toBe("data");
  });
});

// ---------------------------------------------------------------------------
// updateChildViewFieldSelections (via addField / deleteField)
// ---------------------------------------------------------------------------

describe("updateChildViewFieldSelections", () => {
  it("adds new field id to selectedFieldIds of child views on addField", async () => {
    const store = useStore();
    // Pre-populate a child (non-default) view in state
    const childView = makeView(20, 1, { is_default: 0 });
    store.currentViews = [childView];
    store.fields = [makeField(1, 1)];

    const created = {
      id: 2,
      collectionId: 1,
      name: "Author",
      type: "text" as const,
      options: null,
    };
    mockApi.addField.mockResolvedValue(ok(created));
    mockApi.getFields.mockResolvedValue(ok([makeField(1, 1), makeField(2, 1)]));
    // Existing view config has field 1 selected
    const existingConfig: ViewConfig = {
      columnWidths: {},
      sort: [],
      selectedFieldIds: [1],
    };
    mockApi.getViewConfig.mockResolvedValue(ok(existingConfig));
    mockApi.updateViewConfig.mockResolvedValue(ok(true));

    await store.addField({
      collectionId: 1,
      name: "Author",
      type: "text",
      options: null,
    });

    const updateCall = mockApi.updateViewConfig.mock.calls[0][0];
    expect(updateCall.config.selectedFieldIds).toContain(2);
  });

  it("removes deleted field id from selectedFieldIds of child views on deleteField", async () => {
    const store = useStore();
    store.selectedCollection = { id: 1, name: "Col" };
    const childView = makeView(20, 1, { is_default: 0 });
    store.currentViews = [childView];
    store.fields = [makeField(1, 1), makeField(2, 1)];

    mockApi.deleteField.mockResolvedValue(ok(true));
    mockApi.getFields.mockResolvedValue(ok([makeField(2, 1)]));
    const existingConfig: ViewConfig = {
      columnWidths: {},
      sort: [],
      selectedFieldIds: [1, 2],
    };
    mockApi.getViewConfig.mockResolvedValue(ok(existingConfig));
    mockApi.updateViewConfig.mockResolvedValue(ok(true));

    await store.deleteField(1);

    const updateCall = mockApi.updateViewConfig.mock.calls[0][0];
    expect(updateCall.config.selectedFieldIds).toEqual([2]);
    expect(updateCall.config.selectedFieldIds).not.toContain(1);
  });

  it("skips updateViewConfig when selectedFieldIds are unchanged after delete", async () => {
    // Field 2 is deleted but it was never in selectedFieldIds, so the filter
    // produces [1] which equals existing [1] — the unchanged check fires and
    // no write is needed.
    const store = useStore();
    store.selectedCollection = { id: 1, name: "Col" };
    const childView = makeView(20, 1, { is_default: 0 });
    store.currentViews = [childView];
    store.fields = [makeField(1, 1), makeField(2, 1)];

    mockApi.deleteField.mockResolvedValue(ok(true));
    mockApi.getFields.mockResolvedValue(ok([makeField(1, 1)]));
    const existingConfig: ViewConfig = {
      columnWidths: {},
      sort: [],
      selectedFieldIds: [1],
    };
    mockApi.getViewConfig.mockResolvedValue(ok(existingConfig));

    await store.deleteField(2);

    expect(mockApi.updateViewConfig).not.toHaveBeenCalled();
  });
});

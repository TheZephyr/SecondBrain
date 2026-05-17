import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { itemsRepository } from "../itemsRepository";

describe("itemsRepository", () => {
  const mockElectronAPI = {
    getItems: vi.fn(),
    addItem: vi.fn(),
    updateItem: vi.fn(),
    deleteItem: vi.fn(),
    bulkDeleteItems: vi.fn(),
    bulkPatchItems: vi.fn(),
    insertItemAt: vi.fn(),
    duplicateItem: vi.fn(),
    moveItem: vi.fn(),
    reorderItems: vi.fn(),
    importCollection: vi.fn(),
    getNumberFieldRange: vi.fn(),
  };

  beforeEach(() => {
    setActivePinia(createPinia());
    vi.stubGlobal("window", { electronAPI: mockElectronAPI });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("calls getNumberFieldRange and handles IPC", async () => {
    const input = { collectionId: 1, fieldName: "Price" };
    const mockResult = { ok: true, data: { min: 10, max: 100, count: 5 } };
    mockElectronAPI.getNumberFieldRange.mockResolvedValue(mockResult);

    const range = await itemsRepository.getNumberFieldRange(input);

    expect(mockElectronAPI.getNumberFieldRange).toHaveBeenCalledWith(input);
    expect(range).toEqual(mockResult.data);
  });

  it("calls getAllItems and paginates", async () => {
    mockElectronAPI.getItems
      .mockResolvedValueOnce({
        ok: true,
        data: {
          items: [{ id: 1, data: {} }],
          total: 3,
          limit: 2,
          offset: 0,
        },
      })
      .mockResolvedValueOnce({
        ok: true,
        data: {
          items: [{ id: 2, data: {} }, { id: 3, data: {} }],
          total: 3,
          limit: 2,
          offset: 1,
        },
      });

    const all = await itemsRepository.getAllItems(1);
    expect(all).toHaveLength(3);
    expect(mockElectronAPI.getItems).toHaveBeenCalledTimes(2);
  });

  it("calls bulkDeleteItems and returns result or null on error", async () => {
    const input = { collectionId: 1, itemIds: [1] };
    mockElectronAPI.bulkDeleteItems.mockResolvedValue({ ok: true, data: { affectedCount: 1 } });
    let res = await itemsRepository.bulkDeleteItems(input);
    expect(res?.affectedCount).toBe(1);

    mockElectronAPI.bulkDeleteItems.mockResolvedValue({ ok: false, error: "Fail" });
    res = await itemsRepository.bulkDeleteItems(input);
    expect(res).toBeNull();
  });

  it("calls bulkPatchItems and returns result or null on error", async () => {
    const input = { collectionId: 1, updates: [] };
    mockElectronAPI.bulkPatchItems.mockResolvedValue({ ok: true, data: { affectedCount: 0 } });
    let res = await itemsRepository.bulkPatchItems(input);
    expect(res?.affectedCount).toBe(0);

    mockElectronAPI.bulkPatchItems.mockResolvedValue({ ok: false, error: "Fail" });
    res = await itemsRepository.bulkPatchItems(input);
    expect(res).toBeNull();
  });
});

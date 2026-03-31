import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DbWorkerRequest } from "../db/worker-protocol";

type MockDb = {
  close: ReturnType<typeof vi.fn>;
};

type WorkerModule = typeof import("../db/worker");

const initDatabaseConnectionMock = vi.fn();
const getCollectionsMock = vi.fn();
const getCollectionItemCountsMock = vi.fn();
const addCollectionMock = vi.fn();
const updateCollectionMock = vi.fn();
const deleteCollectionMock = vi.fn();
const getFieldsMock = vi.fn();
const addFieldMock = vi.fn();
const updateFieldMock = vi.fn();
const reorderFieldsMock = vi.fn();
const deleteFieldMock = vi.fn();
const getItemsMock = vi.fn();
const addItemMock = vi.fn();
const insertItemAtMock = vi.fn();
const duplicateItemMock = vi.fn();
const moveItemMock = vi.fn();
const updateItemMock = vi.fn();
const deleteItemMock = vi.fn();
const reorderItemsMock = vi.fn();
const bulkDeleteItemsMock = vi.fn();
const bulkPatchItemsMock = vi.fn();
const runImportMock = vi.fn();
const getViewsMock = vi.fn();
const addViewMock = vi.fn();
const updateViewMock = vi.fn();
const deleteViewMock = vi.fn();
const getViewConfigMock = vi.fn();
const updateViewConfigMock = vi.fn();
const reorderViewsMock = vi.fn();
const getArchiveDatabaseSummaryMock = vi.fn();
const exportFullArchiveMock = vi.fn();
const restoreFullArchiveMock = vi.fn();

let workerModule: WorkerModule;
let processOnSpy: ReturnType<typeof vi.spyOn>;
let parentPortMock: {
  on: ReturnType<typeof vi.fn>;
  postMessage: ReturnType<typeof vi.fn>;
};
let exitHandler: (() => void) | undefined;

async function loadWorkerModule(): Promise<WorkerModule> {
  vi.resetModules();
  exitHandler = undefined;

  vi.doMock("worker_threads", () => ({
    parentPort: parentPortMock,
  }));
  vi.doMock("../db/init", () => ({
    initDatabaseConnection: initDatabaseConnectionMock,
  }));
  vi.doMock("../db/collections", () => ({
    getCollections: getCollectionsMock,
    getCollectionItemCounts: getCollectionItemCountsMock,
    addCollection: addCollectionMock,
    updateCollection: updateCollectionMock,
    deleteCollection: deleteCollectionMock,
  }));
  vi.doMock("../db/fields", () => ({
    getFields: getFieldsMock,
    addField: addFieldMock,
    updateField: updateFieldMock,
    reorderFields: reorderFieldsMock,
    deleteField: deleteFieldMock,
  }));
  vi.doMock("../db/items", () => ({
    getItems: getItemsMock,
    addItem: addItemMock,
    insertItemAt: insertItemAtMock,
    duplicateItem: duplicateItemMock,
    moveItem: moveItemMock,
    updateItem: updateItemMock,
    deleteItem: deleteItemMock,
    reorderItems: reorderItemsMock,
    bulkDeleteItems: bulkDeleteItemsMock,
    bulkPatchItems: bulkPatchItemsMock,
    runImport: runImportMock,
  }));
  vi.doMock("../db/views", () => ({
    getViews: getViewsMock,
    addView: addViewMock,
    updateView: updateViewMock,
    deleteView: deleteViewMock,
    getViewConfig: getViewConfigMock,
    updateViewConfig: updateViewConfigMock,
    reorderViews: reorderViewsMock,
  }));
  vi.doMock("../lib/full-archive", () => ({
    getArchiveDatabaseSummary: getArchiveDatabaseSummaryMock,
    exportFullArchive: exportFullArchiveMock,
    restoreFullArchive: restoreFullArchiveMock,
  }));

  workerModule = (await import("../db/worker")) as WorkerModule;
  return workerModule;
}

function resetMocks(): void {
  initDatabaseConnectionMock.mockReset();
  getCollectionsMock.mockReset();
  getCollectionItemCountsMock.mockReset();
  addCollectionMock.mockReset();
  updateCollectionMock.mockReset();
  deleteCollectionMock.mockReset();
  getFieldsMock.mockReset();
  addFieldMock.mockReset();
  updateFieldMock.mockReset();
  reorderFieldsMock.mockReset();
  deleteFieldMock.mockReset();
  getItemsMock.mockReset();
  addItemMock.mockReset();
  insertItemAtMock.mockReset();
  duplicateItemMock.mockReset();
  moveItemMock.mockReset();
  updateItemMock.mockReset();
  deleteItemMock.mockReset();
  reorderItemsMock.mockReset();
  bulkDeleteItemsMock.mockReset();
  bulkPatchItemsMock.mockReset();
  runImportMock.mockReset();
  getViewsMock.mockReset();
  addViewMock.mockReset();
  updateViewMock.mockReset();
  deleteViewMock.mockReset();
  getViewConfigMock.mockReset();
  updateViewConfigMock.mockReset();
  reorderViewsMock.mockReset();
  getArchiveDatabaseSummaryMock.mockReset();
  exportFullArchiveMock.mockReset();
  restoreFullArchiveMock.mockReset();
  parentPortMock.on.mockReset();
  parentPortMock.postMessage.mockReset();
}

beforeEach(async () => {
  parentPortMock = {
    on: vi.fn((_event: string, handler: () => void) => {
      exitHandler = handler;
    }),
    postMessage: vi.fn(),
  };

  processOnSpy = vi.spyOn(process, "on");
  processOnSpy.mockImplementation((event: string, listener: (...args: unknown[]) => void) => {
    if (event === "exit") {
      exitHandler = listener as () => void;
    }
    return process;
  });

  resetMocks();
  await loadWorkerModule();
});

afterEach(() => {
  processOnSpy?.mockRestore();
});

describe("worker helpers", () => {
  it("reinitializes the database by closing the previous connection", () => {
    const firstDb = { close: vi.fn() } as unknown as MockDb;
    const secondDb = { close: vi.fn() } as unknown as MockDb;

    initDatabaseConnectionMock
      .mockReturnValueOnce({ db: firstDb, ftsEnabled: false })
      .mockReturnValueOnce({ db: secondDb, ftsEnabled: true });

    expect(workerModule.initDatabase(":memory:")).toBe(true);
    expect(workerModule.initDatabase(":memory:")).toBe(true);

    expect(firstDb.close).toHaveBeenCalledTimes(1);
    expect(secondDb.close).not.toHaveBeenCalled();
    expect(initDatabaseConnectionMock).toHaveBeenCalledTimes(2);
  });

  it("throws when a request is handled before initialization", () => {
    expect(() =>
      workerModule.handleOperation({ type: "getCollections" }),
    ).toThrow("Database not initialized.");
  });

  it("processes successful requests", () => {
    const db = { close: vi.fn() } as unknown as MockDb;
    initDatabaseConnectionMock.mockReturnValue({ db, ftsEnabled: true });
    getItemsMock.mockReturnValue({ items: [], total: 0, limit: 10, offset: 0 });

    workerModule.initDatabase(":memory:");

    const response = workerModule.processRequest({
      id: 7,
      operation: {
        type: "getItems",
        input: {
          collectionId: 1,
          limit: 10,
          offset: 0,
          search: "",
          sort: [],
        },
      },
    });

    expect(response).toEqual({
      id: 7,
      ok: true,
      data: { items: [], total: 0, limit: 10, offset: 0 },
    });
    expect(getItemsMock).toHaveBeenCalledWith(db, {
      collectionId: 1,
      limit: 10,
      offset: 0,
      search: "",
      sort: [],
    }, true);
  });

  it("serializes worker errors for failed requests", () => {
    const response = workerModule.processRequest({
      id: 8,
      operation: { type: "getCollections" },
    });

    expect(response.ok).toBe(false);
    if (!response.ok) {
      expect(response.error.message).toBe("Database not initialized.");
      expect(response.error.details).toContain("Database not initialized.");
    }
  });

  it("routes init requests through handleOperation", () => {
    const db = { close: vi.fn() } as unknown as MockDb;
    initDatabaseConnectionMock.mockReturnValue({ db, ftsEnabled: false });

    const response = workerModule.processRequest({
      id: 9,
      operation: { type: "init", dbPath: ":memory:" },
    } as DbWorkerRequest);

    expect(response).toEqual({ id: 9, ok: true, data: true });
    expect(initDatabaseConnectionMock).toHaveBeenCalledWith(":memory:");
  });
});

describe("error serialization", () => {
  it("handles falsy and string details", () => {
    const response = workerModule.processRequest({
      id: 10,
      operation: { type: "getCollections" },
    });

    expect(response.ok).toBe(false);
    if (!response.ok) {
      expect(response.error.details).toContain("Database not initialized.");
    }
  });

  it("uses the fallback when details cannot be serialized", () => {
    const circular: { self?: unknown } = {};
    circular.self = circular;
    const db = { close: vi.fn() } as unknown as MockDb;
    initDatabaseConnectionMock.mockReturnValue({ db, ftsEnabled: false });
    getCollectionsMock.mockImplementation(() => {
      throw circular;
    });

    workerModule.initDatabase(":memory:");
    const response = workerModule.processRequest({
      id: 11,
      operation: { type: "getCollections" },
    });

    expect(response.ok).toBe(false);
    if (!response.ok) {
      expect(response.error.message).toBe("Unknown database error.");
      expect(response.error.details).toBe("Unable to serialize error details.");
    }
    expect(circular.self).toBe(circular);
  });

  it("returns unknown database error for non-Error exceptions", () => {
    const db = { close: vi.fn() } as unknown as MockDb;
    initDatabaseConnectionMock.mockReturnValue({ db, ftsEnabled: false });
    getCollectionsMock.mockImplementation(() => {
      throw "boom";
    });

    workerModule.initDatabase(":memory:");
    const response = workerModule.processRequest({
      id: 12,
      operation: { type: "getCollections" },
    });

    expect(response.ok).toBe(false);
    if (!response.ok) {
      expect(response.error.message).toBe("Unknown database error.");
      expect(response.error.details).toBe("boom");
    }
  });

  it("omits details when an exception has no payload", () => {
    const db = { close: vi.fn() } as unknown as MockDb;
    initDatabaseConnectionMock.mockReturnValue({ db, ftsEnabled: false });
    getCollectionsMock.mockImplementation(() => {
      throw undefined;
    });

    workerModule.initDatabase(":memory:");
    const response = workerModule.processRequest({
      id: 14,
      operation: { type: "getCollections" },
    });

    expect(response.ok).toBe(false);
    if (!response.ok) {
      expect(response.error.message).toBe("Unknown database error.");
      expect(response.error.details).toBeUndefined();
    }
  });
});

describe("worker wiring", () => {
  it("posts processed responses for parentPort messages", () => {
    const db = { close: vi.fn() } as unknown as MockDb;
    initDatabaseConnectionMock.mockReturnValue({ db, ftsEnabled: false });
    getCollectionsMock.mockReturnValue([]);

    workerModule.initDatabase(":memory:");
    const request: DbWorkerRequest = {
      id: 13,
      operation: { type: "getCollections" },
    };

    const messageHandler = parentPortMock.on.mock.calls[0]?.[1] as
      | ((message: DbWorkerRequest) => void)
      | undefined;

    expect(messageHandler).toBeDefined();
    messageHandler?.(request);

    expect(parentPortMock.postMessage).toHaveBeenCalledWith({
      id: 13,
      ok: true,
      data: [],
    });
  });

  it("closes the database on process exit", () => {
    const db = { close: vi.fn() } as unknown as MockDb;
    initDatabaseConnectionMock.mockReturnValue({ db, ftsEnabled: false });

    workerModule.initDatabase(":memory:");
    exitHandler?.();

    expect(db.close).toHaveBeenCalledTimes(1);
  });
});

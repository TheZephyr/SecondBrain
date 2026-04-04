import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { effectScope, ref, type EffectScope } from "vue";
import type { IpcResult } from "../../../types/ipc";
import type {
  Collection,
  Field,
  PaginatedItemsResult,
} from "../../../types/models";
import { useCollectionImportExport } from "../useCollectionImportExport";

function ok<T>(data: T): IpcResult<T> {
  return { ok: true, data };
}

function makeElectronAPIMock() {
  return {
    getItems: vi.fn(),
    getFields: vi.fn(),
    importCollection: vi.fn(),
    showSaveDialog: vi.fn(),
    writeFile: vi.fn(),
    showOpenDialog: vi.fn(),
    readFile: vi.fn(),
  };
}

async function withScope<T>(
  callback: (scope: EffectScope) => Promise<T> | T,
): Promise<T> {
  const scope = effectScope();
  try {
    return await callback(scope);
  } finally {
    scope.stop();
  }
}

function makeCollection(): Collection {
  return {
    id: 1,
    name: "Imported",
  };
}

function emptyItemsResult(): PaginatedItemsResult {
  return {
    items: [],
    total: 0,
    limit: 100,
    offset: 0,
  };
}

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

describe("useCollectionImportExport", () => {
  it("builds preview metadata and lets the user override the selected type", async () => {
    mockApi.showOpenDialog.mockResolvedValue(ok("C:\\imports\\books.csv"));
    mockApi.readFile.mockResolvedValue(
      ok(
        [
          '"Due Date","Status","Notes"',
          '"2026-04-01","Open","First"',
          '"2026-04-02","Closed","Second"',
          '"2026-04-03","Open","Third"',
          '"2026-04-04","Closed","Fourth"',
          '"2026-04-05","Open","Fifth"',
          '"2026-04-06","Closed","Sixth"',
          '"2026-04-07","Open","Seventh"',
          '"2026-04-08","Closed","Eighth"',
          '"2026-04-09","Open","Ninth"',
          '"2026-04-10","Closed","Tenth"',
        ].join("\n"),
      ),
    );

    await withScope(async (scope) => {
      const collection = ref(makeCollection());
      const fields = ref<Field[]>([]);
      const composable = scope.run(() =>
        useCollectionImportExport({
          collection,
          fields,
        }),
      );

      if (!composable) {
        throw new Error("Composable failed to initialize");
      }

      await composable.handleSelectFile();

      expect(composable.importPreview.value?.newFields).toEqual([
        {
          name: "Due Date",
          inferredType: "date",
          selectedType: "date",
          inferredChoices: [],
          source: "inference",
          sourceOptions: null,
        },
        {
          name: "Status",
          inferredType: "select",
          selectedType: "select",
          inferredChoices: ["Open", "Closed"],
          source: "inference",
          sourceOptions: null,
        },
        {
          name: "Notes",
          inferredType: "text",
          selectedType: "text",
          inferredChoices: [],
          source: "inference",
          sourceOptions: null,
        },
      ]);

      expect(
        composable.getImportPreviewChoices(
          composable.importPreview.value!.newFields[1],
        ),
      ).toEqual(["Open", "Closed"]);

      composable.updateImportPreviewFieldType("Notes", "longtext");

      expect(composable.importPreview.value?.newFields[2]).toEqual({
        name: "Notes",
        inferredType: "text",
        selectedType: "longtext",
        inferredChoices: [],
        source: "inference",
        sourceOptions: null,
      });
    });
  });

  it("uses schema metadata for preview defaults and import field options", async () => {
    mockApi.showOpenDialog.mockResolvedValue(ok("C:\\imports\\tasks.json"));
    mockApi.readFile.mockResolvedValue(
      ok(
        JSON.stringify({
          _schema: {
            Status: {
              type: "select",
              choices: ["Open", "Closed", "Paused"],
              uniqueCheck: true,
            },
            Due: {
              type: "date",
              format: "YYYY-MM-DD",
            },
          },
          data: [
            { status: "Open", Notes: "Alpha" },
            { status: "Closed", Notes: "Beta" },
          ],
        }),
      ),
    );
    mockApi.importCollection.mockResolvedValue(ok(true));
    mockApi.getFields.mockResolvedValue(ok([] as Field[]));
    mockApi.getItems.mockResolvedValue(ok(emptyItemsResult()));

    await withScope(async (scope) => {
      const collection = ref(makeCollection());
      const fields = ref<Field[]>([]);
      const composable = scope.run(() =>
        useCollectionImportExport({
          collection,
          fields,
        }),
      );

      if (!composable) {
        throw new Error("Composable failed to initialize");
      }

      composable.importFormat.value = "json";

      await composable.handleSelectFile();

      expect(composable.importPreview.value?.newFields).toEqual([
        {
          name: "Status",
          inferredType: "select",
          selectedType: "select",
          inferredChoices: ["Open", "Closed", "Paused"],
          source: "schema",
          sourceOptions: {
            type: "select",
            choices: ["Open", "Closed", "Paused"],
            uniqueCheck: true,
          },
        },
        {
          name: "Due",
          inferredType: "date",
          selectedType: "date",
          inferredChoices: [],
          source: "schema",
          sourceOptions: {
            type: "date",
            format: "YYYY-MM-DD",
          },
        },
        {
          name: "Notes",
          inferredType: "text",
          selectedType: "text",
          inferredChoices: [],
          source: "inference",
          sourceOptions: null,
        },
      ]);

      await composable.handleImport();

      expect(mockApi.importCollection).toHaveBeenCalledWith({
        collectionId: 1,
        mode: "append",
        newFields: [
          {
            collectionId: 1,
            name: "Status",
            type: "select",
            options: JSON.stringify({
              choices: ["Open", "Closed", "Paused"],
              uniqueCheck: true,
            }),
            orderIndex: 0,
          },
          {
            collectionId: 1,
            name: "Due",
            type: "date",
            options: JSON.stringify({
              format: "YYYY-MM-DD",
            }),
            orderIndex: 1,
          },
          {
            collectionId: 1,
            name: "Notes",
            type: "text",
            options: null,
            orderIndex: 2,
          },
        ],
        items: [
          {
            collectionId: 1,
            data: { Status: "Open", Due: "", Notes: "Alpha" },
          },
          {
            collectionId: 1,
            data: { Status: "Closed", Due: "", Notes: "Beta" },
          },
        ],
      });
    });
  });

  it("lets manual overrides replace schema defaults", async () => {
    mockApi.showOpenDialog.mockResolvedValue(ok("C:\\imports\\tasks.json"));
    mockApi.readFile.mockResolvedValue(
      ok(
        JSON.stringify({
          _schema: {
            Status: {
              type: "select",
              choices: ["Open", "Closed", "Paused"],
            },
          },
          data: [{ Status: "Open" }, { Status: "Closed" }],
        }),
      ),
    );
    mockApi.importCollection.mockResolvedValue(ok(true));
    mockApi.getFields.mockResolvedValue(ok([] as Field[]));
    mockApi.getItems.mockResolvedValue(ok(emptyItemsResult()));

    await withScope(async (scope) => {
      const collection = ref(makeCollection());
      const fields = ref<Field[]>([]);
      const composable = scope.run(() =>
        useCollectionImportExport({
          collection,
          fields,
        }),
      );

      if (!composable) {
        throw new Error("Composable failed to initialize");
      }

      composable.importFormat.value = "json";

      await composable.handleSelectFile();
      composable.updateImportPreviewFieldType("Status", "text");
      await composable.handleImport();

      expect(mockApi.importCollection).toHaveBeenCalledWith({
        collectionId: 1,
        mode: "append",
        newFields: [
          {
            collectionId: 1,
            name: "Status",
            type: "text",
            options: null,
            orderIndex: 0,
          },
        ],
        items: [
          {
            collectionId: 1,
            data: { Status: "Open" },
          },
          {
            collectionId: 1,
            data: { Status: "Closed" },
          },
        ],
      });
    });
  });

  it("submits selected field types, inferred select choices, and normalized JSON booleans", async () => {
    mockApi.showOpenDialog.mockResolvedValue(ok("C:\\imports\\tasks.json"));
    mockApi.readFile.mockResolvedValue(
      ok(
        JSON.stringify([
          { Status: "Open", Done: true, Notes: "Alpha" },
          { Status: "Closed", Done: false, Notes: "Beta" },
          { Status: "Open", Done: true, Notes: "Gamma" },
          { Status: "Closed", Done: false, Notes: "Delta" },
          { Status: "Open", Done: true, Notes: "Epsilon" },
          { Status: "Closed", Done: false, Notes: "Zeta" },
          { Status: "Open", Done: true, Notes: "Eta" },
          { Status: "Closed", Done: false, Notes: "Theta" },
          { Status: "Open", Done: true, Notes: "Iota" },
          { Status: "Closed", Done: false, Notes: "Kappa" },
        ]),
      ),
    );
    mockApi.importCollection.mockResolvedValue(ok(true));
    mockApi.getFields.mockResolvedValue(ok([] as Field[]));
    mockApi.getItems.mockResolvedValue(ok(emptyItemsResult()));

    await withScope(async (scope) => {
      const collection = ref(makeCollection());
      const fields = ref<Field[]>([]);
      const composable = scope.run(() =>
        useCollectionImportExport({
          collection,
          fields,
        }),
      );

      if (!composable) {
        throw new Error("Composable failed to initialize");
      }

      composable.importFormat.value = "json";

      await composable.handleSelectFile();
      composable.updateImportPreviewFieldType("Notes", "longtext");
      await composable.handleImport();

      expect(mockApi.importCollection).toHaveBeenCalledOnce();
      expect(mockApi.importCollection).toHaveBeenCalledWith({
        collectionId: 1,
        mode: "append",
        newFields: [
          {
            collectionId: 1,
            name: "Status",
            type: "select",
            options: JSON.stringify({ choices: ["Open", "Closed"] }),
            orderIndex: 0,
          },
          {
            collectionId: 1,
            name: "Done",
            type: "boolean",
            options: null,
            orderIndex: 1,
          },
          {
            collectionId: 1,
            name: "Notes",
            type: "longtext",
            options: null,
            orderIndex: 2,
          },
        ],
        items: [
          {
            collectionId: 1,
            data: { Status: "Open", Done: "1", Notes: "Alpha" },
          },
          {
            collectionId: 1,
            data: { Status: "Closed", Done: "0", Notes: "Beta" },
          },
          {
            collectionId: 1,
            data: { Status: "Open", Done: "1", Notes: "Gamma" },
          },
          {
            collectionId: 1,
            data: { Status: "Closed", Done: "0", Notes: "Delta" },
          },
          {
            collectionId: 1,
            data: { Status: "Open", Done: "1", Notes: "Epsilon" },
          },
          {
            collectionId: 1,
            data: { Status: "Closed", Done: "0", Notes: "Zeta" },
          },
          {
            collectionId: 1,
            data: { Status: "Open", Done: "1", Notes: "Eta" },
          },
          {
            collectionId: 1,
            data: { Status: "Closed", Done: "0", Notes: "Theta" },
          },
          {
            collectionId: 1,
            data: { Status: "Open", Done: "1", Notes: "Iota" },
          },
          {
            collectionId: 1,
            data: { Status: "Closed", Done: "0", Notes: "Kappa" },
          },
        ],
      });
    });
  });

  it("derives select and multiselect options when the user manually overrides the field types", async () => {
    mockApi.showOpenDialog.mockResolvedValue(ok("C:\\imports\\exported.csv"));
    mockApi.readFile.mockResolvedValue(
      ok(
        [
          '"text","select","multi"',
          '"test","two","[]"',
          '"test","three","[""one"",""three""]"',
          '"placeholder","two","[""two""]"',
          '"test","two","[]"',
          '"placeholder","one","[""three""]"',
          '"placeholder","one","[""one"",""two""]"',
          '"placeholder","","[]"',
        ].join("\n"),
      ),
    );
    mockApi.importCollection.mockResolvedValue(ok(true));
    mockApi.getFields.mockResolvedValue(ok([] as Field[]));
    mockApi.getItems.mockResolvedValue(ok(emptyItemsResult()));

    await withScope(async (scope) => {
      const collection = ref(makeCollection());
      const fields = ref<Field[]>([]);
      const composable = scope.run(() =>
        useCollectionImportExport({
          collection,
          fields,
        }),
      );

      if (!composable) {
        throw new Error("Composable failed to initialize");
      }

      await composable.handleSelectFile();
      composable.updateImportPreviewFieldType("text", "text");
      composable.updateImportPreviewFieldType("select", "select");
      composable.updateImportPreviewFieldType("multi", "multiselect");
      await composable.handleImport();

      expect(mockApi.importCollection).toHaveBeenCalledOnce();
      expect(mockApi.importCollection).toHaveBeenCalledWith({
        collectionId: 1,
        mode: "append",
        newFields: [
          {
            collectionId: 1,
            name: "text",
            type: "text",
            options: null,
            orderIndex: 0,
          },
          {
            collectionId: 1,
            name: "select",
            type: "select",
            options: JSON.stringify({ choices: ["two", "three", "one"] }),
            orderIndex: 1,
          },
          {
            collectionId: 1,
            name: "multi",
            type: "multiselect",
            options: JSON.stringify({ choices: ["one", "three", "two"] }),
            orderIndex: 2,
          },
        ],
        items: [
          {
            collectionId: 1,
            data: { text: "test", select: "two", multi: null },
          },
          {
            collectionId: 1,
            data: {
              text: "test",
              select: "three",
              multi: '["one","three"]',
            },
          },
          {
            collectionId: 1,
            data: {
              text: "placeholder",
              select: "two",
              multi: '["two"]',
            },
          },
          {
            collectionId: 1,
            data: { text: "test", select: "two", multi: null },
          },
          {
            collectionId: 1,
            data: {
              text: "placeholder",
              select: "one",
              multi: '["three"]',
            },
          },
          {
            collectionId: 1,
            data: {
              text: "placeholder",
              select: "one",
              multi: '["one","two"]',
            },
          },
          {
            collectionId: 1,
            data: { text: "placeholder", select: "", multi: null },
          },
        ],
      });
    });
  });

  it("returns preview choices for manual select and multiselect overrides", async () => {
    mockApi.showOpenDialog.mockResolvedValue(ok("C:\\imports\\exported.csv"));
    mockApi.readFile.mockResolvedValue(
      ok(
        [
          '"text","select","multi"',
          '"test","two","[]"',
          '"test","three","[""one"",""three""]"',
          '"placeholder","two","[""two""]"',
          '"test","two","[]"',
        ].join("\n"),
      ),
    );

    await withScope(async (scope) => {
      const collection = ref(makeCollection());
      const fields = ref<Field[]>([]);
      const composable = scope.run(() =>
        useCollectionImportExport({
          collection,
          fields,
        }),
      );

      if (!composable) {
        throw new Error("Composable failed to initialize");
      }

      await composable.handleSelectFile();
      if (!composable.importPreview.value) {
        throw new Error("Import preview was not created");
      }

      composable.updateImportPreviewFieldType("select", "select");
      composable.updateImportPreviewFieldType("multi", "multiselect");

      const updatedPreview = composable.importPreview.value;
      if (!updatedPreview) {
        throw new Error("Import preview was cleared unexpectedly");
      }

      const selectField = updatedPreview.newFields.find((field) => field.name === "select");
      const multiField = updatedPreview.newFields.find((field) => field.name === "multi");

      expect(selectField).toBeTruthy();
      expect(multiField).toBeTruthy();

      expect(composable.getImportPreviewChoices(selectField!)).toEqual([
        "two",
        "three",
      ]);
      expect(composable.getImportPreviewChoices(multiField!)).toEqual([
        "one",
        "three",
        "two",
      ]);
    });
  });
});

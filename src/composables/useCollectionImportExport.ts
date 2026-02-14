import { ref, type Ref } from "vue";
import { useStore } from "../store";
import { useNotificationsStore } from "../stores/notifications";
import { handleIpc } from "../utils/ipc";
import type {
  Collection,
  Field,
  Item,
  ItemData,
  NewFieldInput,
  NewItemInput,
  ExportFormat,
  ImportMode,
} from "../types/models";
import {
  buildImportPreview,
  parseImportContent,
  serializeItemsToCsv,
  serializeItemsToJson,
  type ImportPreview,
  type ParsedImportData,
} from "../utils/collectionImportExport";
import { isSafeFieldName } from "../validation/fieldNames";
import { fieldNameSchema } from "../validation/schemas";

type UseCollectionImportExportParams = {
  collection: Ref<Collection>;
  fields: Ref<Field[]>;
};

export function useCollectionImportExport({
  collection,
  fields,
}: UseCollectionImportExportParams) {
  const store = useStore();
  const notifications = useNotificationsStore();

  const exportFormat = ref<ExportFormat>("csv");
  const isExporting = ref(false);

  const importFormat = ref<ExportFormat>("csv");
  const importMode = ref<ImportMode>("append");
  const isImporting = ref(false);
  const selectedFile = ref<string | null>(null);
  const importPreview = ref<ImportPreview | null>(null);

  const exportFormatOptions = [
    { label: "CSV", value: "csv" },
    { label: "JSON", value: "json" },
  ];

  function getDefaultFilename(
    collectionName: string,
    format: ExportFormat,
  ): string {
    const date = new Date().toISOString().split("T")[0];
    const safeName = collectionName.replace(/[^a-z0-9]/gi, "-").toLowerCase();
    return `${safeName}-${date}.${format}`;
  }

  function handleParseError(error: unknown): boolean {
    if (error instanceof Error) {
      if (error.message === "EMPTY_CSV") {
        console.error("Empty CSV file");
        return true;
      }
      if (error.message === "JSON_NOT_ARRAY") {
        console.error("JSON must be an array");
        return true;
      }
    }
    return false;
  }

  async function fetchAllItemsForExport(collectionId: number): Promise<Item[]> {
    const pageSize = 500;
    let offset = 0;
    let total = 0;
    const allItems: Item[] = [];

    do {
      const result = await window.electronAPI.getItems({
        collectionId,
        limit: pageSize,
        offset,
        search: "",
        sort: [],
      });

      const payload = handleIpc(result, "db:getItems", {
        items: [] as Item[],
        total: 0,
        limit: pageSize,
        offset,
      });

      allItems.push(...payload.items);
      total = payload.total;
      offset += payload.items.length;

      if (payload.items.length === 0) {
        break;
      }
    } while (offset < total);

    return allItems;
  }

  async function handleExport() {
    isExporting.value = true;

    try {
      const extension = exportFormat.value;
      const filters = [
        {
          name: exportFormat.value === "csv" ? "CSV Files" : "JSON Files",
          extensions: [extension],
        },
        { name: "All Files", extensions: ["*"] },
      ];

      const filePathResult = await window.electronAPI.showSaveDialog({
        title: `Export ${collection.value.name}`,
        defaultPath: getDefaultFilename(
          collection.value.name,
          exportFormat.value,
        ),
        filters,
      });

      if (!filePathResult.ok) {
        handleIpc(filePathResult, "export:showSaveDialog", null);
        isExporting.value = false;
        return;
      }

      const filePath = filePathResult.data;
      if (!filePath) {
        isExporting.value = false;
        return;
      }

      const exportItems = await fetchAllItemsForExport(collection.value.id);
      const content =
        exportFormat.value === "csv"
          ? serializeItemsToCsv(exportItems, fields.value)
          : serializeItemsToJson(exportItems, fields.value);

      const writeResult = await window.electronAPI.writeFile(filePath, content);
      const success = handleIpc(writeResult, "export:writeFile", false);

      if (success) {
        console.log("Export successful!");
      } else {
        console.error("Export failed");
      }
    } catch (error) {
      console.error("Export error:", error);
    } finally {
      isExporting.value = false;
    }
  }

  async function handleSelectFile() {
    try {
      const extension = importFormat.value;
      const filters = [
        {
          name: importFormat.value === "csv" ? "CSV Files" : "JSON Files",
          extensions: [extension],
        },
        { name: "All Files", extensions: ["*"] },
      ];

      const filePathResult = await window.electronAPI.showOpenDialog({
        title: "Select File to Import",
        filters,
      });

      if (!filePathResult.ok) {
        handleIpc(filePathResult, "import:showOpenDialog", null);
        return;
      }

      const filePath = filePathResult.data;
      if (!filePath) {
        return;
      }

      selectedFile.value = filePath;

      const contentResult = await window.electronAPI.readFile(filePath);
      if (!contentResult.ok) {
        handleIpc(contentResult, "import:readFile", null);
        return;
      }

      const content = contentResult.data;
      if (content === null) {
        console.error("Failed to read file");
        return;
      }

      if (!content.trim()) {
        alert("The selected file is empty.");
        selectedFile.value = null;
        return;
      }

      let parsed: ParsedImportData;
      try {
        parsed = parseImportContent(importFormat.value, content);
      } catch (error) {
        if (handleParseError(error)) {
          return;
        }
        throw error;
      }

      importPreview.value = buildImportPreview(parsed, fields.value);
    } catch (error) {
      console.error("Error selecting file:", error);
      selectedFile.value = null;
      importPreview.value = null;
    }
  }

  function cancelImport() {
    selectedFile.value = null;
    importPreview.value = null;
    importFormat.value = "csv";
    importMode.value = "append";
  }

  async function handleImport() {
    if (!selectedFile.value || !importPreview.value) {
      return;
    }

    isImporting.value = true;

    try {
      const contentResult = await window.electronAPI.readFile(
        selectedFile.value,
      );
      if (!contentResult.ok) {
        handleIpc(contentResult, "import:readFile", null);
        return;
      }

      const content = contentResult.data;
      if (!content) {
        console.error("Failed to read file");
        return;
      }

      let parsed: ParsedImportData;
      try {
        parsed = parseImportContent(importFormat.value, content);
      } catch (error) {
        if (handleParseError(error)) {
          return;
        }
        throw error;
      }

      const { rows: parsedData, fields: fileFields } = parsed;
      const invalidFields = fileFields.filter(
        (field) => !fieldNameSchema.safeParse(field).success,
      );

      if (invalidFields.length > 0) {
        notifications.push({
          severity: "warn",
          summary: "Invalid field names",
          detail: `Import blocked. Invalid fields: ${invalidFields.join(", ")}`,
          life: 7000,
        });
        return;
      }

      const normalizedFileFields = fileFields.map((field) =>
        fieldNameSchema.parse(field),
      );

      const safeExistingFields = fields.value.filter((field) =>
        isSafeFieldName(field.name),
      );
      const fieldMap = new Map<string, string>();
      safeExistingFields.forEach((field) =>
        fieldMap.set(field.name.toLowerCase(), field.name),
      );

      const newFieldNames = normalizedFileFields.filter(
        (field) => !fieldMap.has(field.toLowerCase()),
      );

      const newFieldsToCreate: NewFieldInput[] = [];
      if (safeExistingFields.length === 0) {
        for (let i = 0; i < normalizedFileFields.length; i++) {
          newFieldsToCreate.push({
            collectionId: collection.value.id,
            name: normalizedFileFields[i],
            type: "text",
            options: null,
            orderIndex: i,
          });
        }
      } else if (newFieldNames.length > 0) {
        const nextOrderIndex =
          Math.max(...fields.value.map((field) => field.order_index), -1) + 1;
        for (let i = 0; i < newFieldNames.length; i++) {
          newFieldsToCreate.push({
            collectionId: collection.value.id,
            name: newFieldNames[i],
            type: "text",
            options: null,
            orderIndex: nextOrderIndex + i,
          });
        }
      }

      fieldMap.clear();
      const currentFieldNames = [
        ...safeExistingFields.map((field) => field.name),
        ...newFieldNames,
      ];
      currentFieldNames.forEach((fieldName) =>
        fieldMap.set(fieldName.toLowerCase(), fieldName),
      );

      const itemsToAdd: NewItemInput[] = parsedData.map((row) => {
        const itemData: ItemData = {};
        for (const fieldName of currentFieldNames) {
          itemData[fieldName] = "";
        }

        for (const csvHeader of normalizedFileFields) {
          const val = row[csvHeader];
          const targetFieldName = fieldMap.get(csvHeader.toLowerCase());

          if (targetFieldName) {
            itemData[targetFieldName] =
              val !== undefined && val !== null ? val : "";
          }
        }

        return {
          collectionId: collection.value.id,
          data: itemData,
        };
      });

      const importResult = await window.electronAPI.importCollection({
        collectionId: collection.value.id,
        mode: importMode.value,
        newFields: newFieldsToCreate,
        items: itemsToAdd,
      });
      const success = handleIpc(importResult, "db:importCollection", false);
      if (!success) {
        return;
      }

      await store.loadFields(collection.value.id);
      await store.loadItems(collection.value.id);

      cancelImport();
      console.log(`Successfully imported ${itemsToAdd.length} items`);
    } catch (error) {
      console.error("Import error:", error);
    } finally {
      isImporting.value = false;
    }
  }

  return {
    exportFormat,
    exportFormatOptions,
    isExporting,
    handleExport,
    importFormat,
    importMode,
    isImporting,
    importPreview,
    handleSelectFile,
    handleImport,
    cancelImport,
  };
}

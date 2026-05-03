import { ref, type Ref } from "vue";
import { itemsRepository } from "../../repositories/itemsRepository";
import { systemRepository } from "../../repositories/systemRepository";
import { useCollectionsStore } from "../../stores/collections";
import { useItemsStore } from "../../stores/items";
import { useNotificationsStore } from "../../stores/notifications";
import type {
  Collection,
  Field,
  FieldType,
  Item,
  ItemData,
  ItemDataValue,
  NewFieldInput,
  NewItemInput,
  ExportFormat,
  ImportMode,
} from "../../types/models";
import {
  buildImportPreview,
  parseImportContent,
  serializeItemsToCsv,
  serializeItemsToJson,
  type ImportRow,
  type ImportPreviewNewField,
  type ImportPreview,
  type ParsedImportData,
} from "../../utils/collectionImportExport";
import { serializeFieldOptions } from "../../utils/fieldOptions";
import {
  parseMultiselectValue,
  serializeMultiselectValue,
} from "../../utils/fieldValues";
import { isSafeFieldName } from "../../validation/fieldNames";
import { fieldNameSchema } from "../../validation/schemas";

type UseCollectionImportExportParams = {
  collection: Ref<Collection>;
  fields: Ref<Field[]>;
};

export function useCollectionImportExport({
  collection,
  fields,
}: UseCollectionImportExportParams) {
  const collectionsStore = useCollectionsStore();
  const itemsStore = useItemsStore();
  const notifications = useNotificationsStore();

  const exportFormat = ref<ExportFormat>("csv");
  const exportIncludeSchema = ref(false);
  const isExporting = ref(false);

  const importFormat = ref<ExportFormat>("csv");
  const importMode = ref<ImportMode>("append");
  const isImporting = ref(false);
  const selectedFile = ref<string | null>(null);
  const importPreview = ref<ImportPreview | null>(null);
  const parsedImportData = ref<ParsedImportData | null>(null);

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
      if (error.message === "JSON_SCHEMA_DATA_NOT_ARRAY") {
        console.error("JSON schema export must contain a data array");
        return true;
      }
    }
    return false;
  }

  async function fetchAllItemsForExport(collectionId: number): Promise<Item[]> {
    return itemsRepository.getAllItems(collectionId);
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

      const filePath = await systemRepository.showSaveDialog({
        title: `Export ${collection.value.name}`,
        defaultPath: getDefaultFilename(
          collection.value.name,
          exportFormat.value,
        ),
        filters,
      });
      if (!filePath) {
        isExporting.value = false;
        return;
      }

      const exportItems = await fetchAllItemsForExport(collection.value.id);
      const content =
        exportFormat.value === "csv"
          ? serializeItemsToCsv(exportItems, fields.value)
          : serializeItemsToJson(exportItems, fields.value, {
              includeSchema: exportIncludeSchema.value,
            });

      const success = await systemRepository.writeFile(filePath, content);

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
      parsedImportData.value = null;
      importPreview.value = null;

      const extension = importFormat.value;
      const filters = [
        {
          name: importFormat.value === "csv" ? "CSV Files" : "JSON Files",
          extensions: [extension],
        },
        { name: "All Files", extensions: ["*"] },
      ];

      const filePath = await systemRepository.showOpenDialog({
        title: "Select File to Import",
        filters,
      });
      if (!filePath) {
        return;
      }

      selectedFile.value = filePath;

      const content = await systemRepository.readFile(filePath);
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
          selectedFile.value = null;
          return;
        }
        throw error;
      }

      parsedImportData.value = parsed;
      importPreview.value = buildImportPreview(parsed, fields.value);
    } catch (error) {
      console.error("Error selecting file:", error);
      selectedFile.value = null;
      parsedImportData.value = null;
      importPreview.value = null;
    }
  }

  function updateImportPreviewFieldType(
    fieldName: string,
    selectedType: FieldType,
  ) {
    if (!importPreview.value) {
      return;
    }

    importPreview.value = {
      ...importPreview.value,
      newFields: importPreview.value.newFields.map((field) =>
        field.name === fieldName ? { ...field, selectedType } : field,
      ),
    };
  }

  function cancelImport() {
    selectedFile.value = null;
    parsedImportData.value = null;
    importPreview.value = null;
    importFormat.value = "csv";
    importMode.value = "append";
  }

  function getNewFieldPreviewMap(
    previewFields: ImportPreviewNewField[],
  ): Map<string, ImportPreviewNewField> {
    return new Map(
      previewFields.map((field) => [field.name.toLowerCase(), field]),
    );
  }

  function collectDistinctChoices(values: string[]): string[] {
    const choices: string[] = [];
    const seen = new Set<string>();

    for (const value of values) {
      const normalized = value.toLowerCase();
      if (seen.has(normalized)) {
        continue;
      }

      seen.add(normalized);
      choices.push(value);
    }

    return choices;
  }

  function getParsedRowValue(
    row: ImportRow,
    fieldName: string,
  ): ImportRow[string] {
    if (Object.prototype.hasOwnProperty.call(row, fieldName)) {
      return row[fieldName];
    }

    const normalizedFieldName = fieldName.toLowerCase();
    const matchingKey = Object.keys(row).find(
      (key) => key.toLowerCase() === normalizedFieldName,
    );

    return matchingKey ? row[matchingKey] : undefined;
  }

  function getImportFieldChoices(
    fieldName: string,
    targetType: FieldType,
    parsedRows: ParsedImportData["rows"],
  ): string[] {
    if (targetType === "select") {
      return collectDistinctChoices(
        parsedRows.flatMap((row) => {
          const value = getParsedRowValue(row, fieldName);
          if (value === null || value === undefined || value === "") {
            return [];
          }
          return [String(value)];
        }),
      );
    }

    if (targetType === "multiselect") {
      return collectDistinctChoices(
        parsedRows.flatMap((row) => {
          const value = getParsedRowValue(row, fieldName);
          if (typeof value !== "string") {
            return [];
          }
          return parseMultiselectValue(value);
        }),
      );
    }

    return [];
  }

  function getImportPreviewChoices(
    field: ImportPreviewNewField,
  ): string[] {
    const schemaOptions = getSchemaBackedFieldOptions(field, field.selectedType);
    if (schemaOptions && Array.isArray(schemaOptions.choices)) {
      return schemaOptions.choices.filter(
        (choice): choice is string => typeof choice === "string",
      );
    }

    if (
      !parsedImportData.value ||
      (field.selectedType !== "select" && field.selectedType !== "multiselect")
    ) {
      return [];
    }

    return getImportFieldChoices(
      field.name,
      field.selectedType,
      parsedImportData.value.rows,
    );
  }

  function getSchemaBackedFieldOptions(
    field: ImportPreviewNewField,
    targetType: FieldType,
  ): Record<string, unknown> | null {
    if (field.source !== "schema" || !field.sourceOptions) {
      return null;
    }

    const { type: schemaType, ...schemaOptions } = field.sourceOptions;
    if (targetType === schemaType) {
      return schemaOptions;
    }

    if (
      (targetType === "select" || targetType === "multiselect") &&
      Array.isArray(schemaOptions.choices)
    ) {
      return {
        choices: schemaOptions.choices.filter(
          (choice): choice is string => typeof choice === "string",
        ),
      };
    }

    return null;
  }

  function getImportFieldOptions(
    field: ImportPreviewNewField,
    parsedRows: ParsedImportData["rows"],
  ): string | null {
    const schemaOptions = getSchemaBackedFieldOptions(field, field.selectedType);
    if (schemaOptions) {
      return serializeFieldOptions(schemaOptions);
    }

    if (
      field.selectedType !== "select" &&
      field.selectedType !== "multiselect"
    ) {
      return null;
    }

    return serializeFieldOptions({
      choices: getImportFieldChoices(field.name, field.selectedType, parsedRows),
    });
  }

  function toStoredBooleanValue(
    value: ItemDataValue | boolean | undefined,
  ): ItemDataValue {
    if (typeof value === "boolean") {
      return value ? "1" : "0";
    }

    if (typeof value === "number") {
      return value === 1 ? "1" : "0";
    }

    if (typeof value === "string") {
      const normalized = value.trim().toLowerCase();
      if (
        normalized === "1" ||
        normalized === "true" ||
        normalized === "yes"
      ) {
        return "1";
      }

      if (
        normalized === "0" ||
        normalized === "false" ||
        normalized === "no"
      ) {
        return "0";
      }
    }

    return "0";
  }

  function normalizeImportedValue(
    value: ItemDataValue | boolean | undefined,
    targetType: FieldType,
  ): ItemDataValue {
    if (targetType === "boolean") {
      return toStoredBooleanValue(value);
    }

    if (targetType === "multiselect") {
      if (typeof value !== "string") {
        return null;
      }

      return serializeMultiselectValue(parseMultiselectValue(value));
    }

    if (typeof value === "boolean") {
      return value ? "true" : "false";
    }

    return value !== undefined ? value : "";
  }

  async function handleImport() {
    if (!selectedFile.value || !importPreview.value || !parsedImportData.value) {
      return;
    }

    isImporting.value = true;

    try {
      const parsed = parsedImportData.value;

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
      const previewNewFields = getNewFieldPreviewMap(importPreview.value.newFields);

      const newFieldsToCreate: NewFieldInput[] = [];
      const nextOrderIndex =
        Math.max(...fields.value.map((field) => field.order_index), -1) + 1;
      const fieldsToCreate =
        safeExistingFields.length === 0 ? normalizedFileFields : newFieldNames;

      for (let i = 0; i < fieldsToCreate.length; i++) {
        const previewField = previewNewFields.get(
          fieldsToCreate[i].toLowerCase(),
        );
        newFieldsToCreate.push({
          collectionId: collection.value.id,
          name: fieldsToCreate[i],
          type: previewField?.selectedType ?? "text",
          options: previewField
            ? getImportFieldOptions(previewField, parsedData)
            : null,
          orderIndex: nextOrderIndex + i,
        });
      }

      const targetFieldMap = new Map<
        string,
        { name: string; type: FieldType }
      >();
      const currentFieldNames = [
        ...safeExistingFields.map((field) => field.name),
        ...newFieldNames,
      ];
      safeExistingFields.forEach((field) =>
        targetFieldMap.set(field.name.toLowerCase(), {
          name: field.name,
          type: field.type,
        }),
      );
      newFieldNames.forEach((fieldName) =>
        targetFieldMap.set(fieldName.toLowerCase(), {
          name: fieldName,
          type: previewNewFields.get(fieldName.toLowerCase())?.selectedType ?? "text",
        }),
      );

      const itemsToAdd: NewItemInput[] = parsedData.map((row) => {
        const itemData: ItemData = {};
        for (const fieldName of currentFieldNames) {
          itemData[fieldName] = "";
        }

        for (const csvHeader of normalizedFileFields) {
          const val = getParsedRowValue(row, csvHeader);
          const targetField = targetFieldMap.get(csvHeader.toLowerCase());

          if (targetField) {
            itemData[targetField.name] = normalizeImportedValue(
              val,
              targetField.type,
            );
          }
        }

        return {
          collectionId: collection.value.id,
          data: itemData,
        };
      });

      const success = await itemsRepository.importCollection({
        collectionId: collection.value.id,
        mode: importMode.value,
        newFields: newFieldsToCreate,
        items: itemsToAdd,
      });
      if (!success) {
        return;
      }

      await collectionsStore.loadFields(collection.value.id);
      await itemsStore.loadItems(collection.value.id);

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
    exportIncludeSchema,
    exportFormatOptions,
    isExporting,
    handleExport,
    importFormat,
    importMode,
    isImporting,
    importPreview,
    getImportPreviewChoices,
    updateImportPreviewFieldType,
    handleSelectFile,
    handleImport,
    cancelImport,
  };
}

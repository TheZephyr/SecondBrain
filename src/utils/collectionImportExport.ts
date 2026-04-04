import * as Papa from "papaparse";
import type {
  Field,
  FieldType,
  Item,
  ItemData,
  ItemDataValue,
  ExportFormat,
} from "../types/models";
import { parseFieldOptions } from "./fieldOptions";

export type ImportValue = ItemDataValue | boolean;
export type ImportRow = Record<string, ImportValue | undefined>;

export type ImportSchemaField = {
  type: FieldType;
} & Record<string, unknown>;

export type ImportFieldSource = "inference" | "schema";

export type ImportPreviewNewField = {
  name: string;
  inferredType: FieldType;
  selectedType: FieldType;
  inferredChoices: string[];
  source: ImportFieldSource;
  sourceOptions: Record<string, unknown> | null;
};

export type ImportPreview = {
  itemCount: number;
  fields: string[];
  newFields: ImportPreviewNewField[];
  matchedFields: string[];
  sample: ImportRow[];
};

export type ParsedImportData = {
  rows: ImportRow[];
  fields: string[];
  schema?: Record<string, ImportSchemaField> | null;
};

const DATE_STORAGE_FORMAT_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const BOOLEAN_TRUE_STRINGS = new Set(["true", "yes", "1"]);
const BOOLEAN_FALSE_STRINGS = new Set(["false", "no", "0"]);
const MAX_SELECT_DISTINCT_VALUES = 15;
const MAX_SELECT_UNIQUENESS_RATIO = 0.3;

export function escapeCsvValue(value: ItemDataValue | undefined): string {
  if (value === null || value === undefined) {
    return "\"\"";
  }

  const stringValue = String(value);
  const escapedValue = stringValue.replace(/"/g, "\"\"");
  return `"${escapedValue}"`;
}

function sortFields(fields: Field[]): Field[] {
  return [...fields].sort((a, b) => a.order_index - b.order_index);
}

export function serializeItemsToCsv(items: Item[], fields: Field[]): string {
  const ordered = sortFields(fields);
  const headers = ordered.map((field) => escapeCsvValue(field.name));
  const csvLines = [headers.join(",")];

  for (const item of items) {
    const row = ordered.map((field) => {
      const value = item.data[field.name];
      return escapeCsvValue(value);
    });
    csvLines.push(row.join(","));
  }

  return csvLines.join("\n");
}

function buildExportRows(items: Item[], fields: Field[]): ItemData[] {
  const ordered = sortFields(fields);
  return items.map((item) => {
    const orderedData: ItemData = {};
    for (const field of ordered) {
      orderedData[field.name] = item.data[field.name] ?? "";
    }
    return orderedData;
  });
}

function buildExportSchema(fields: Field[]): Record<string, ImportSchemaField> {
  const ordered = sortFields(fields);
  const schema: Record<string, ImportSchemaField> = {};

  for (const field of ordered) {
    const parsedOptions = parseFieldOptions(field.type, field.options);
    schema[field.name] = {
      type: field.type,
      ...parsedOptions,
    };
  }

  return schema;
}

export function serializeItemsToJson(
  items: Item[],
  fields: Field[],
  options?: { includeSchema?: boolean },
): string {
  const exportData = buildExportRows(items, fields);
  if (!options?.includeSchema) {
    return JSON.stringify(exportData, null, 2);
  }

  return JSON.stringify(
    {
      _schema: buildExportSchema(fields),
      data: exportData,
    },
    null,
    2,
  );
}

function collectJsonFields(rows: ImportRow[]): string[] {
  const fields: string[] = [];
  const seen = new Set<string>();

  for (const row of rows) {
    for (const key of Object.keys(row)) {
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      fields.push(key);
    }
  }

  return fields;
}

function isFieldType(value: unknown): value is FieldType {
  return (
    value === "text" ||
    value === "longtext" ||
    value === "number" ||
    value === "date" ||
    value === "select" ||
    value === "multiselect" ||
    value === "boolean" ||
    value === "url" ||
    value === "rating"
  );
}

function parseJsonSchema(
  rawSchema: unknown,
): Record<string, ImportSchemaField> | null {
  if (!rawSchema || typeof rawSchema !== "object" || Array.isArray(rawSchema)) {
    return null;
  }

  const schema: Record<string, ImportSchemaField> = {};

  for (const [fieldName, rawEntry] of Object.entries(rawSchema)) {
    if (
      !rawEntry ||
      typeof rawEntry !== "object" ||
      Array.isArray(rawEntry) ||
      !isFieldType((rawEntry as { type?: unknown }).type)
    ) {
      continue;
    }

    schema[fieldName] = {
      ...(rawEntry as Record<string, unknown>),
      type: (rawEntry as { type: FieldType }).type,
    };
  }

  return schema;
}

function mergeFieldsWithSchema(
  rowFields: string[],
  schema: Record<string, ImportSchemaField> | null,
): string[] {
  if (!schema) {
    return rowFields;
  }

  const mergedFields = [...Object.keys(schema)];
  const seen = new Set(mergedFields.map((field) => field.toLowerCase()));

  for (const field of rowFields) {
    if (seen.has(field.toLowerCase())) {
      continue;
    }
    seen.add(field.toLowerCase());
    mergedFields.push(field);
  }

  return mergedFields;
}

function getSchemaEntryChoices(entry: ImportSchemaField): string[] {
  const rawChoices = entry.choices;
  if (!Array.isArray(rawChoices)) {
    return [];
  }

  return rawChoices.filter((choice): choice is string => typeof choice === "string");
}

function buildSchemaPreviewField(
  fieldName: string,
  entry: ImportSchemaField,
): ImportPreviewNewField {
  return {
    name: fieldName,
    inferredType: entry.type,
    selectedType: entry.type,
    inferredChoices: getSchemaEntryChoices(entry),
    source: "schema",
    sourceOptions: { ...entry },
  };
}

function buildInferredPreviewField(
  fieldName: string,
  values: ImportValue[],
): ImportPreviewNewField {
  const inferredField = inferImportField(values);
  return {
    ...inferredField,
    name: fieldName,
    source: "inference",
    sourceOptions: null,
  };
}

function getRowValueByFieldName(
  row: ImportRow,
  fieldName: string,
): ImportValue | undefined {
  if (Object.prototype.hasOwnProperty.call(row, fieldName)) {
    return row[fieldName];
  }

  const normalizedFieldName = fieldName.toLowerCase();
  const matchingKey = Object.keys(row).find(
    (key) => key.toLowerCase() === normalizedFieldName,
  );

  return matchingKey ? row[matchingKey] : undefined;
}

function getSchemaEntryForField(
  schema: Record<string, ImportSchemaField> | null,
  fieldName: string,
): ImportSchemaField | null {
  if (!schema) {
    return null;
  }

  if (schema[fieldName]) {
    return schema[fieldName];
  }

  const normalizedFieldName = fieldName.toLowerCase();
  const matchingKey = Object.keys(schema).find(
    (key) => key.toLowerCase() === normalizedFieldName,
  );

  return matchingKey ? schema[matchingKey] : null;
}

function parseJsonRows(content: string): ParsedImportData {
  const parsed = JSON.parse(content) as unknown;
  if (Array.isArray(parsed)) {
    const rows = parsed as ImportRow[];
    return {
      rows,
      fields: collectJsonFields(rows),
      schema: null,
    };
  }

  if (!parsed || typeof parsed !== "object") {
    throw new Error("JSON_NOT_ARRAY");
  }

  const wrapped = parsed as { _schema?: unknown; data?: unknown };
  if (!Object.prototype.hasOwnProperty.call(wrapped, "_schema")) {
    throw new Error("JSON_NOT_ARRAY");
  }

  if (!Array.isArray(wrapped.data)) {
    throw new Error("JSON_SCHEMA_DATA_NOT_ARRAY");
  }

  const rows = wrapped.data as ImportRow[];
  const schema = parseJsonSchema(wrapped._schema);
  const rowFields = collectJsonFields(rows);

  return {
    rows,
    fields: mergeFieldsWithSchema(rowFields, schema),
    schema,
  };
}

export function parseImportContent(
  format: ExportFormat,
  content: string,
): ParsedImportData {
  if (format === "csv") {
    const trimmed = content.trim();
    if (!trimmed) {
      throw new Error("EMPTY_CSV");
    }

    const result = Papa.parse<Record<string, string>>(trimmed, {
      header: true,
      delimiter: ",",
      skipEmptyLines: false,
      transformHeader: (header) => header.replace(/^\uFEFF/, "").trim(),
      transform: (value) => value.trim(),
    });

    const fields = result.meta.fields ?? [];
    const rows: ImportRow[] = result.data.map((row) => {
      const normalized: ImportRow = {};
      for (const field of fields) {
        normalized[field] = row[field] ?? "";
      }
      return normalized;
    });

    return { rows, fields, schema: null };
  }

  return parseJsonRows(content);
}

function isEmptyImportValue(value: ImportValue | undefined): boolean {
  return value === "" || value === null || value === undefined;
}

function isBooleanImportValue(value: ImportValue): boolean {
  if (typeof value === "boolean") {
    return true;
  }

  if (typeof value === "number") {
    return value === 0 || value === 1;
  }

  if (typeof value !== "string") {
    return false;
  }

  const normalized = value.trim().toLowerCase();
  return (
    BOOLEAN_TRUE_STRINGS.has(normalized) || BOOLEAN_FALSE_STRINGS.has(normalized)
  );
}

function isDateImportValue(value: ImportValue): boolean {
  return typeof value === "string" && DATE_STORAGE_FORMAT_REGEX.test(value);
}

function isNumberImportValue(value: ImportValue): boolean {
  if (typeof value === "number") {
    return Number.isFinite(value);
  }

  if (typeof value !== "string") {
    return false;
  }

  const normalized = value.trim();
  if (!normalized) {
    return false;
  }

  return Number.isFinite(Number(normalized));
}

function collectDistinctImportChoices(values: ImportValue[]): string[] {
  const distinctChoices: string[] = [];
  const seenChoices = new Set<string>();

  for (const value of values) {
    const choice = String(value);
    const normalizedChoice = choice.toLowerCase();
    if (seenChoices.has(normalizedChoice)) {
      continue;
    }

    seenChoices.add(normalizedChoice);
    distinctChoices.push(choice);
  }

  return distinctChoices;
}

function inferImportField(values: ImportValue[]): ImportPreviewNewField {
  if (values.length === 0) {
    return {
      name: "",
      inferredType: "text",
      selectedType: "text",
      inferredChoices: [],
      source: "inference",
      sourceOptions: null,
    };
  }

  if (values.every(isBooleanImportValue)) {
    return {
      name: "",
      inferredType: "boolean",
      selectedType: "boolean",
      inferredChoices: [],
      source: "inference",
      sourceOptions: null,
    };
  }

  if (values.every(isDateImportValue)) {
    return {
      name: "",
      inferredType: "date",
      selectedType: "date",
      inferredChoices: [],
      source: "inference",
      sourceOptions: null,
    };
  }

  if (values.every(isNumberImportValue)) {
    return {
      name: "",
      inferredType: "number",
      selectedType: "number",
      inferredChoices: [],
      source: "inference",
      sourceOptions: null,
    };
  }

  const distinctChoices = collectDistinctImportChoices(values);
  const distinctCount = distinctChoices.length;
  const uniquenessRatio = distinctCount / values.length;
  const isSelectCandidate =
    distinctCount === 1 ||
    (distinctCount < MAX_SELECT_DISTINCT_VALUES &&
      uniquenessRatio < MAX_SELECT_UNIQUENESS_RATIO);

  if (isSelectCandidate) {
    return {
      name: "",
      inferredType: "select",
      selectedType: "select",
      inferredChoices: distinctChoices,
      source: "inference",
      sourceOptions: null,
    };
  }

  return {
    name: "",
    inferredType: "text",
    selectedType: "text",
    inferredChoices: [],
    source: "inference",
    sourceOptions: null,
  };
}

export function buildImportPreview(
  parsed: ParsedImportData,
  existingFields: Field[],
): ImportPreview {
  const matchedFields: string[] = [];
  const newFields: ImportPreviewNewField[] = [];
  const fieldMap = new Map<string, string>();

  existingFields.forEach((field) =>
    fieldMap.set(field.name.toLowerCase(), field.name),
  );

  parsed.fields.forEach((fileField) => {
    if (fieldMap.has(fileField.toLowerCase())) {
      matchedFields.push(fileField);
    } else {
      const schemaField = getSchemaEntryForField(parsed.schema ?? null, fileField);
      if (schemaField) {
        newFields.push(buildSchemaPreviewField(fileField, schemaField));
        return;
      }

      const values = parsed.rows
        .map((row) => getRowValueByFieldName(row, fileField))
        .filter(
          (value): value is ImportValue => !isEmptyImportValue(value),
        );
      newFields.push(buildInferredPreviewField(fileField, values));
    }
  });

  return {
    itemCount: parsed.rows.length,
    fields: parsed.fields,
    newFields,
    matchedFields,
    sample: parsed.rows.slice(0, 3),
  };
}

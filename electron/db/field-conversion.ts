import Database from "better-sqlite3";
import type {
  ConvertFieldTypeInput,
  FieldConversionPreview,
  FieldConversionPreviewRow,
  FieldConversionRisk,
  FieldOptions,
  FieldType,
  ItemData,
  ItemDataValue,
  MultiselectFieldOptions,
  RatingFieldOptions,
  SelectFieldOptions,
} from "../../src/types/models";
import { itemDataSchema } from "../../src/validation/schemas";
import {
  parseFieldOptions,
  serializeFieldOptions,
} from "../../src/utils/fieldOptions";
import { toNumber } from "./query-utils";

type FieldRow = {
  id: number;
  collection_id: number;
  name: string;
  type: FieldType;
  description: string | null;
  options: string | null;
  order_index: number | bigint;
};

type ItemRow = {
  id: number;
  data: string;
};

type ConvertedValue = {
  value: ItemDataValue;
  cleared: boolean;
  generatedChoices: string[];
};

const WIPE_CONVERSIONS = new Set<string>([
  "number:date",
  "number:url",
  "date:number",
  "date:boolean",
  "date:url",
  "date:rating",
  "multiselect:url",
  "boolean:date",
  "boolean:url",
  "url:number",
  "url:date",
  "url:rating",
  "rating:date",
  "rating:url",
]);

const SAFE_CONVERSIONS = new Set<string>([
  "text:longtext",
  "text:select",
  "text:multiselect",
  "text:url",
  "longtext:text",
  "longtext:select",
  "longtext:multiselect",
  "longtext:url",
  "number:text",
  "number:longtext",
  "number:select",
  "number:multiselect",
  "date:text",
  "date:longtext",
  "date:select",
  "date:multiselect",
  "select:text",
  "select:longtext",
  "select:multiselect",
  "select:url",
  "multiselect:longtext",
  "boolean:text",
  "boolean:longtext",
  "boolean:number",
  "boolean:select",
  "boolean:multiselect",
  "url:text",
  "url:longtext",
  "url:select",
  "url:multiselect",
  "rating:text",
  "rating:longtext",
  "rating:number",
  "rating:select",
  "rating:multiselect",
]);

function conversionKey(sourceType: FieldType, targetType: FieldType): string {
  return `${sourceType}:${targetType}`;
}

export function getFieldConversionRisk(
  sourceType: FieldType,
  targetType: FieldType,
): FieldConversionRisk {
  if (sourceType === targetType) {
    return "safe";
  }
  const key = conversionKey(sourceType, targetType);
  if (WIPE_CONVERSIONS.has(key)) {
    return "wipe";
  }
  if (SAFE_CONVERSIONS.has(key)) {
    return "safe";
  }
  return "lossy";
}

function getField(database: Database.Database, fieldId: number): FieldRow {
  const field = database
    .prepare("SELECT * FROM fields WHERE id = ?")
    .get(fieldId) as FieldRow | undefined;
  if (!field) {
    throw new Error(`Field ${fieldId} not found.`);
  }
  return field;
}

function getCollectionItems(
  database: Database.Database,
  collectionId: number,
): ItemRow[] {
  return database
    .prepare(
      'SELECT id, data FROM items WHERE collection_id = ? ORDER BY "order" ASC, id ASC',
    )
    .all(collectionId) as ItemRow[];
}

function parseStoredData(rawData: string, itemId: number): ItemData {
  let raw: unknown;
  try {
    raw = JSON.parse(rawData);
  } catch (error) {
    throw new Error(
      `Field conversion failed. Item ${itemId} contains invalid JSON: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  const parsed = itemDataSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(
      `Field conversion failed. Item ${itemId} contains invalid data structure.`,
    );
  }
  return parsed.data as ItemData;
}

function parseMultiselectStorage(value: ItemDataValue | undefined): string[] {
  if (typeof value !== "string" || value.trim().length === 0) {
    return [];
  }
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed)
      ? parsed.filter((entry): entry is string => typeof entry === "string")
      : [];
  } catch {
    return [];
  }
}

function isEmptySourceValue(type: FieldType, value: ItemDataValue): boolean {
  if (value === null || value === "") {
    return true;
  }
  if (type === "multiselect") {
    return parseMultiselectStorage(value).length === 0;
  }
  return false;
}

function numberFromValue(value: ItemDataValue): number | null {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number.parseFloat(value)
        : Number.NaN;
  return Number.isFinite(parsed) ? parsed : null;
}

function parseStrictDate(value: ItemDataValue): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const patterns: Array<{
    regex: RegExp;
    map: (match: RegExpMatchArray) => { year: number; month: number; day: number };
  }> = [
    {
      regex: /^(\d{4})-(\d{2})-(\d{2})$/,
      map: (match) => ({
        year: Number(match[1]),
        month: Number(match[2]),
        day: Number(match[3]),
      }),
    },
    {
      regex: /^(\d{4})\.(\d{2})\.(\d{2})$/,
      map: (match) => ({
        year: Number(match[1]),
        month: Number(match[2]),
        day: Number(match[3]),
      }),
    },
    {
      regex: /^(\d{2})-(\d{2})-(\d{4})$/,
      map: (match) => ({
        day: Number(match[1]),
        month: Number(match[2]),
        year: Number(match[3]),
      }),
    },
    {
      regex: /^(\d{2})\.(\d{2})\.(\d{4})$/,
      map: (match) => ({
        day: Number(match[1]),
        month: Number(match[2]),
        year: Number(match[3]),
      }),
    },
  ];

  for (const pattern of patterns) {
    const match = value.match(pattern.regex);
    if (!match) {
      continue;
    }
    const parts = pattern.map(match);
    const date = new Date(parts.year, parts.month - 1, parts.day);
    if (
      date.getFullYear() === parts.year &&
      date.getMonth() === parts.month - 1 &&
      date.getDate() === parts.day
    ) {
      return [
        String(parts.year).padStart(4, "0"),
        String(parts.month).padStart(2, "0"),
        String(parts.day).padStart(2, "0"),
      ].join("-");
    }
  }
  return null;
}

function getRatingRange(options: FieldOptions): { min: number; max: number } {
  const ratingOptions = options as RatingFieldOptions;
  const min =
    typeof ratingOptions.min === "number" && Number.isFinite(ratingOptions.min)
      ? ratingOptions.min
      : 0;
  const max =
    typeof ratingOptions.max === "number" && Number.isFinite(ratingOptions.max)
      ? ratingOptions.max
      : 5;
  return min <= max ? { min, max } : { min: max, max: min };
}

function parseTargetOptions(
  targetType: FieldType,
  rawOptions: string | null,
): FieldOptions {
  return parseFieldOptions(targetType, rawOptions);
}

function convertBooleanSource(value: ItemDataValue): boolean {
  if (typeof value === "number") {
    return value === 1;
  }
  if (typeof value === "string") {
    return value === "1";
  }
  return false;
}

function convertValue(
  sourceType: FieldType,
  targetType: FieldType,
  value: ItemDataValue,
  targetOptions: FieldOptions,
): ConvertedValue {
  const risk = getFieldConversionRisk(sourceType, targetType);
  if (risk === "wipe") {
    return { value: null, cleared: true, generatedChoices: [] };
  }

  const sourceMulti = parseMultiselectStorage(value);
  const firstMulti = sourceMulti[0] ?? "";
  const ratingRange = getRatingRange(targetOptions);
  const generatedChoices: string[] = [];
  const addChoice = (choice: string): void => {
    if (choice.length > 0 && !generatedChoices.includes(choice)) {
      generatedChoices.push(choice);
    }
  };

  switch (targetType) {
    case "text":
    case "longtext": {
      if (sourceType === "multiselect") {
        return {
          value: sourceMulti.join(", "),
          cleared: false,
          generatedChoices,
        };
      }
      return { value: String(value), cleared: false, generatedChoices };
    }
    case "number": {
      if (sourceType === "boolean") {
        return {
          value: convertBooleanSource(value) ? 1 : 0,
          cleared: false,
          generatedChoices,
        };
      }
      const source = sourceType === "multiselect" ? firstMulti : value;
      const parsed = numberFromValue(source);
      return {
        value: parsed,
        cleared: parsed === null,
        generatedChoices,
      };
    }
    case "date": {
      const source = sourceType === "multiselect" ? firstMulti : value;
      const parsed = parseStrictDate(source);
      return {
        value: parsed,
        cleared: parsed === null,
        generatedChoices,
      };
    }
    case "select": {
      if (sourceType === "multiselect") {
        addChoice(firstMulti);
        return { value: firstMulti || null, cleared: !firstMulti, generatedChoices };
      }
      if (sourceType === "boolean") {
        const choice = convertBooleanSource(value) ? "true" : "false";
        addChoice("true");
        addChoice("false");
        return { value: choice, cleared: false, generatedChoices };
      }
      const choice = String(value);
      addChoice(choice);
      return { value: choice, cleared: false, generatedChoices };
    }
    case "multiselect": {
      if (sourceType === "boolean") {
        const choice = convertBooleanSource(value) ? "true" : "false";
        addChoice("true");
        addChoice("false");
        return {
          value: JSON.stringify([choice]),
          cleared: false,
          generatedChoices,
        };
      }
      const choice =
        sourceType === "multiselect"
          ? firstMulti
          : sourceType === "number" || sourceType === "rating"
            ? String(value)
            : String(value);
      addChoice(choice);
      return {
        value: choice ? JSON.stringify([choice]) : null,
        cleared: !choice,
        generatedChoices,
      };
    }
    case "boolean": {
      if (sourceType === "multiselect") {
        return {
          value: sourceMulti.length > 0 ? "1" : "0",
          cleared: false,
          generatedChoices,
        };
      }
      if (sourceType === "number") {
        return {
          value: value === 1 ? "1" : "0",
          cleared: false,
          generatedChoices,
        };
      }
      if (sourceType === "rating") {
        const parsed = numberFromValue(value);
        return {
          value: parsed !== null && parsed > 0 ? "1" : "0",
          cleared: false,
          generatedChoices,
        };
      }
      if (sourceType === "url") {
        return {
          value: typeof value === "string" && value.trim().length > 0 ? "1" : "0",
          cleared: false,
          generatedChoices,
        };
      }
      const normalized = String(value).trim().toLowerCase();
      return {
        value: ["1", "true", "yes"].includes(normalized) ? "1" : "0",
        cleared: false,
        generatedChoices,
      };
    }
    case "url": {
      return { value: String(value), cleared: false, generatedChoices };
    }
    case "rating": {
      if (sourceType === "boolean") {
        const parsed = convertBooleanSource(value) ? 1 : 0;
        const inRange = parsed >= ratingRange.min && parsed <= ratingRange.max;
        return { value: inRange ? parsed : null, cleared: !inRange, generatedChoices };
      }
      const source = sourceType === "multiselect" ? firstMulti : value;
      const parsed = numberFromValue(source);
      const inRange =
        parsed !== null && parsed >= ratingRange.min && parsed <= ratingRange.max;
      return { value: inRange ? parsed : null, cleared: !inRange, generatedChoices };
    }
    default: {
      const exhaustive: never = targetType;
      return exhaustive;
    }
  }
}

function formatPreviewValue(
  type: FieldType,
  value: ItemDataValue | undefined,
): string {
  if (value === undefined || value === null || value === "") {
    return "Empty";
  }
  if (type === "multiselect") {
    const parsed = parseMultiselectStorage(value);
    return parsed.length > 0 ? parsed.join(", ") : "Empty";
  }
  if (type === "boolean") {
    return value === "1" || value === 1 ? "true" : "false";
  }
  return String(value);
}

function mergeChoices(
  targetType: FieldType,
  sourceType: FieldType,
  sourceOptions: FieldOptions,
  targetOptions: FieldOptions,
  generatedChoices: string[],
): FieldOptions {
  if (targetType !== "select" && targetType !== "multiselect") {
    return targetOptions;
  }

  const sourceChoiceOptions = sourceOptions as
    | SelectFieldOptions
    | MultiselectFieldOptions;
  const targetChoiceOptions = targetOptions as
    | SelectFieldOptions
    | MultiselectFieldOptions;
  const baseChoices =
    sourceType === "select" || sourceType === "multiselect"
      ? (sourceChoiceOptions.choices ?? [])
      : (targetChoiceOptions.choices ?? []);
  const choices = [...baseChoices];
  for (const choice of generatedChoices) {
    if (choice.length > 0 && !choices.includes(choice)) {
      choices.push(choice);
    }
  }

  return {
    ...targetOptions,
    choices,
    optionColors:
      sourceType === "select" || sourceType === "multiselect"
        ? { ...(sourceChoiceOptions.optionColors ?? {}) }
        : { ...(targetChoiceOptions.optionColors ?? {}) },
  };
}

function buildConversionPreview(
  database: Database.Database,
  input: ConvertFieldTypeInput,
): {
  preview: FieldConversionPreview;
  itemUpdates: Array<{ id: number; data: ItemData }>;
} {
  const field = getField(database, input.fieldId);
  const sourceOptions = parseFieldOptions(field.type, field.options);
  const initialTargetOptions = parseTargetOptions(
    input.targetType,
    input.targetOptions,
  );
  const rows = getCollectionItems(database, field.collection_id);
  const risk = getFieldConversionRisk(field.type, input.targetType);
  const generatedChoices: string[] = [];
  const samples: FieldConversionPreviewRow[] = [];
  const itemUpdates: Array<{ id: number; data: ItemData }> = [];
  let affectedCount = 0;
  let convertedCount = 0;
  let clearedCount = 0;
  let skippedEmptyCount = 0;

  for (const row of rows) {
    const data = parseStoredData(row.data, row.id);
    if (!Object.prototype.hasOwnProperty.call(data, field.name)) {
      continue;
    }

    const currentValue = data[field.name];
    if (currentValue === undefined || isEmptySourceValue(field.type, currentValue)) {
      skippedEmptyCount += 1;
      const nextData = { ...data };
      if (
        currentValue !== undefined &&
        input.targetType !== "text" &&
        input.targetType !== "longtext" &&
        input.targetType !== "url"
      ) {
        nextData[field.name] = null;
        itemUpdates.push({ id: row.id, data: nextData });
      }
      continue;
    }

    affectedCount += 1;
    const converted = convertValue(
      field.type,
      input.targetType,
      currentValue,
      initialTargetOptions,
    );
    for (const choice of converted.generatedChoices) {
      if (!generatedChoices.includes(choice)) {
        generatedChoices.push(choice);
      }
    }

    if (converted.cleared) {
      clearedCount += 1;
    } else {
      convertedCount += 1;
    }

    if (samples.length < 3) {
      samples.push({
        itemId: row.id,
        before: formatPreviewValue(field.type, currentValue),
        after: formatPreviewValue(input.targetType, converted.value),
        willClear: converted.cleared,
      });
    }

    itemUpdates.push({
      id: row.id,
      data: { ...data, [field.name]: converted.value },
    });
  }

  const finalTargetOptions = mergeChoices(
    input.targetType,
    field.type,
    sourceOptions,
    initialTargetOptions,
    generatedChoices,
  );
  const targetOptions = serializeFieldOptions(finalTargetOptions);

  return {
    preview: {
      fieldId: field.id,
      fieldName: field.name,
      collectionId: field.collection_id,
      sourceType: field.type,
      targetType: input.targetType,
      risk,
      affectedCount,
      convertedCount,
      clearedCount,
      skippedEmptyCount,
      generatedChoices,
      targetOptions,
      samples,
    },
    itemUpdates,
  };
}

export function previewFieldConversion(
  database: Database.Database,
  input: ConvertFieldTypeInput,
): FieldConversionPreview {
  return buildConversionPreview(database, input).preview;
}

export function convertFieldType(
  database: Database.Database,
  input: ConvertFieldTypeInput,
): FieldConversionPreview {
  const tx = database.transaction((payload: ConvertFieldTypeInput) => {
    const { preview, itemUpdates } = buildConversionPreview(database, payload);
    const updateField = database.prepare(
      "UPDATE fields SET type = ?, options = ? WHERE id = ?",
    );
    const fieldInfo = updateField.run(
      preview.targetType,
      preview.targetOptions,
      preview.fieldId,
    );
    if (toNumber(fieldInfo.changes) !== 1) {
      throw new Error(`Failed to update field ${preview.fieldId}.`);
    }

    const updateItem = database.prepare(
      "UPDATE items SET data = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND collection_id = ?",
    );
    for (const update of itemUpdates) {
      const parsed = itemDataSchema.safeParse(update.data);
      if (!parsed.success) {
        throw new Error(
          `Field conversion failed. Item ${update.id} converted data is invalid.`,
        );
      }
      const info = updateItem.run(
        JSON.stringify(parsed.data),
        update.id,
        preview.collectionId,
      );
      if (toNumber(info.changes) !== 1) {
        throw new Error(`Failed to update item ${update.id}.`);
      }
    }

    return preview;
  });

  return tx(input) as FieldConversionPreview;
}

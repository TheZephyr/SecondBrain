import type Database from "better-sqlite3";
import type {
  BooleanFieldOptions,
  DateFieldOptions,
  Field,
  FieldType,
  FullArchiveCollection,
  FullArchiveDatabaseSummary,
  FullArchiveDroppedViewReferenceWarning,
  FullArchiveField,
  FullArchiveFile,
  FullArchiveItem,
  FullArchiveItemData,
  FullArchiveItemValue,
  FullArchiveRestoreReport,
  FullArchiveSkippedEntityWarning,
  FullArchiveStatMismatch,
  FullArchiveView,
  ItemData,
  LongTextFieldOptions,
  MultiselectFieldOptions,
  NumberFieldOptions,
  RatingFieldOptions,
  SelectFieldOptions,
  TextFieldOptions,
  UrlFieldOptions,
  ViewConfig,
  ViewType,
} from "../../src/types/models";
import { parseFieldOptions } from "../../src/utils/fieldOptions";
import {
  parseBooleanValue,
  parseMultiselectValue,
  parseRatingValue,
} from "../../src/utils/fieldValues";
import {
  FullArchiveCalendarViewConfigSchema,
  FullArchiveGridViewConfigSchema,
  FullArchiveKanbanViewConfigSchema,
} from "../../src/validation/schemas";
import { isSafeFieldName } from "../../src/validation/fieldNames";
import { toNumber } from "../db/query-utils";
import { parseStoredViewConfig } from "../db/views";

type CollectionRow = {
  id: number;
  name: string;
  created_at: string;
};

type ViewRow = {
  id: number;
  collection_id: number;
  name: string;
  type: string;
  is_default: number | bigint;
  order: number | bigint;
  config: string | null;
};

type ItemRow = {
  id: number;
  collection_id: number;
  order: number | bigint;
  data: string;
};

type CountRow = {
  count: number | bigint;
};

const SUPPORTED_FIELD_TYPES = new Set<FieldType>([
  "text",
  "longtext",
  "number",
  "date",
  "select",
  "multiselect",
  "boolean",
  "url",
  "rating",
]);

const SUPPORTED_VIEW_TYPES = new Set<ViewType>(["grid", "kanban", "calendar"]);

function isSupportedFieldType(type: string): type is FieldType {
  return SUPPORTED_FIELD_TYPES.has(type as FieldType);
}

function isSupportedViewType(type: string): type is ViewType {
  return SUPPORTED_VIEW_TYPES.has(type as ViewType);
}

function parseJsonObject(raw: string | null): Record<string, unknown> | null {
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return null;
    }
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
}

function normalizeArchiveFieldOptions(
  fieldType: FieldType,
  rawOptions: string | null,
): Record<string, unknown> {
  const parsed = parseFieldOptions(fieldType, rawOptions);

  switch (fieldType) {
    case "text": {
      const textOptions = parsed as TextFieldOptions;
      return {
        defaultValue:
          typeof textOptions.defaultValue === "string"
            ? textOptions.defaultValue
            : null,
        uniqueCheck: Boolean(textOptions.uniqueCheck),
      };
    }
    case "longtext": {
      const longTextOptions = parsed as LongTextFieldOptions;
      return {
        richText: Boolean(longTextOptions.richText),
        defaultValue:
          typeof longTextOptions.defaultValue === "string"
            ? longTextOptions.defaultValue
            : null,
        uniqueCheck: Boolean(longTextOptions.uniqueCheck),
      };
    }
    case "number": {
      const numberOptions = parsed as NumberFieldOptions;
      return {
        defaultValue:
          typeof numberOptions.defaultValue === "number" &&
          Number.isFinite(numberOptions.defaultValue)
            ? numberOptions.defaultValue
            : null,
        uniqueCheck: Boolean(numberOptions.uniqueCheck),
        showAsChip: Boolean(numberOptions.showAsChip),
        showThousandsSeparator: Boolean(numberOptions.showThousandsSeparator),
        colorScale:
          numberOptions.colorScale &&
          typeof numberOptions.colorScale === "object" &&
          typeof numberOptions.colorScale.direction === "string" &&
          typeof numberOptions.colorScale.style === "string"
            ? {
                direction: numberOptions.colorScale.direction,
                style: numberOptions.colorScale.style,
              }
            : null,
      };
    }
    case "date": {
      const dateOptions = parsed as DateFieldOptions;
      return {
        format:
          typeof dateOptions.format === "string"
            ? dateOptions.format
            : "YYYY-MM-DD",
        defaultValue:
          typeof dateOptions.defaultValue === "string"
            ? dateOptions.defaultValue
            : null,
        uniqueCheck: Boolean(dateOptions.uniqueCheck),
        highlight:
          dateOptions.highlight &&
          typeof dateOptions.highlight === "object" &&
          typeof dateOptions.highlight.type === "string" &&
          typeof dateOptions.highlight.color === "string"
            ? {
                type: dateOptions.highlight.type,
                date:
                  typeof dateOptions.highlight.date === "string"
                    ? dateOptions.highlight.date
                    : null,
                target:
                  dateOptions.highlight.target === "current"
                    ? "current"
                    : "date",
                color: dateOptions.highlight.color,
              }
            : null,
      };
    }
    case "select": {
      const selectOptions = parsed as SelectFieldOptions;
      return {
        choices: Array.isArray(selectOptions.choices)
          ? selectOptions.choices.filter(
              (choice): choice is string => typeof choice === "string",
            )
          : [],
        defaultValue:
          typeof selectOptions.defaultValue === "string"
            ? selectOptions.defaultValue
            : null,
        uniqueCheck: Boolean(selectOptions.uniqueCheck),
        optionColors:
          selectOptions.optionColors && typeof selectOptions.optionColors === "object"
            ? selectOptions.optionColors
            : {},
      };
    }
    case "multiselect": {
      const multiselectOptions = parsed as MultiselectFieldOptions;
      return {
        choices: Array.isArray(multiselectOptions.choices)
          ? multiselectOptions.choices.filter(
              (choice): choice is string => typeof choice === "string",
            )
          : [],
        defaultValue: Array.isArray(multiselectOptions.defaultValue)
          ? multiselectOptions.defaultValue.filter(
              (choice): choice is string => typeof choice === "string",
            )
          : null,
        uniqueCheck: Boolean(multiselectOptions.uniqueCheck),
        optionColors:
          multiselectOptions.optionColors &&
          typeof multiselectOptions.optionColors === "object"
            ? multiselectOptions.optionColors
            : {},
      };
    }
    case "boolean": {
      const booleanOptions = parsed as BooleanFieldOptions;
      return {
        icon:
          typeof booleanOptions.icon === "string"
            ? booleanOptions.icon
            : "square",
      };
    }
    case "url": {
      const urlOptions = parsed as UrlFieldOptions;
      return {
        defaultValue:
          typeof urlOptions.defaultValue === "string"
            ? urlOptions.defaultValue
            : null,
        uniqueCheck: Boolean(urlOptions.uniqueCheck),
      };
    }
    case "rating": {
      const ratingOptions = parsed as RatingFieldOptions;
      return {
        icon:
          typeof ratingOptions.icon === "string" ? ratingOptions.icon : "star",
        color:
          typeof ratingOptions.color === "string"
            ? ratingOptions.color
            : "currentColor",
        min:
          typeof ratingOptions.min === "number" &&
          Number.isFinite(ratingOptions.min)
            ? ratingOptions.min
            : 0,
        max:
          typeof ratingOptions.max === "number" &&
          Number.isFinite(ratingOptions.max)
            ? ratingOptions.max
            : 5,
        defaultValue:
          typeof ratingOptions.defaultValue === "number" &&
          Number.isFinite(ratingOptions.defaultValue)
            ? ratingOptions.defaultValue
            : null,
        uniqueCheck: Boolean(ratingOptions.uniqueCheck),
        optionColors:
          ratingOptions.optionColors &&
          typeof ratingOptions.optionColors === "object"
            ? ratingOptions.optionColors
            : {},
      };
    }
  }
}

function toArchiveItemValue(
  fieldType: FieldType,
  value: string | number | null | undefined,
): FullArchiveItemValue {
  switch (fieldType) {
    case "multiselect":
      return parseMultiselectValue(value);
    case "boolean":
      return parseBooleanValue(value);
    case "rating":
      return parseRatingValue(value);
    case "number":
      return typeof value === "number" && Number.isFinite(value) ? value : null;
    case "text":
    case "longtext":
    case "date":
    case "select":
    case "url":
      return typeof value === "string" ? value : null;
  }
}

function toStoredItemValue(
  fieldType: FieldType,
  value: FullArchiveItemValue | undefined,
): string | number | null {
  switch (fieldType) {
    case "multiselect":
      return Array.isArray(value)
        ? JSON.stringify(
            value.filter((entry): entry is string => typeof entry === "string"),
          )
        : JSON.stringify([]);
    case "boolean":
      return value === true ? "1" : "0";
    case "rating":
      return typeof value === "number" && Number.isFinite(value) ? value : null;
    case "number":
      return typeof value === "number" && Number.isFinite(value) ? value : null;
    case "text":
    case "longtext":
    case "date":
    case "select":
    case "url":
      return typeof value === "string" ? value : null;
  }
}

function selectCollections(database: Database.Database): CollectionRow[] {
  return database
    .prepare(
      "SELECT id, name, created_at FROM collections ORDER BY created_at ASC, id ASC",
    )
    .all() as CollectionRow[];
}

function selectFields(
  database: Database.Database,
  collectionId: number,
): Field[] {
  return database
    .prepare(
      "SELECT * FROM fields WHERE collection_id = ? ORDER BY order_index ASC, id ASC",
    )
    .all(collectionId) as Field[];
}

function selectViews(
  database: Database.Database,
  collectionId: number,
): ViewRow[] {
  return database
    .prepare(
      'SELECT id, collection_id, name, type, is_default, "order", config FROM views WHERE collection_id = ? ORDER BY "order" ASC, id ASC',
    )
    .all(collectionId) as ViewRow[];
}

function selectItems(
  database: Database.Database,
  collectionId: number,
): ItemRow[] {
  return database
    .prepare(
      'SELECT id, collection_id, "order", data FROM items WHERE collection_id = ? ORDER BY "order" ASC, id ASC',
    )
    .all(collectionId) as ItemRow[];
}

function buildArchiveViewConfig(
  viewType: ViewType,
  config: ViewConfig | null,
  orderedFields: Field[],
): FullArchiveView["config"] {
  const fieldNameById = new Map(
    orderedFields.map((field) => [field.id, field.name]),
  );
  const orderedFieldNames = orderedFields.map((field) => field.name);
  const selectedFields =
    Array.isArray(config?.selectedFieldIds) &&
    config.selectedFieldIds.length > 0
      ? config.selectedFieldIds
          .map((fieldId) => fieldNameById.get(fieldId))
          .filter(
            (fieldName): fieldName is string => typeof fieldName === "string",
          )
      : orderedFieldNames;

  if (viewType === "grid") {
    const columnWidths: Record<string, number> = {};
    for (const [fieldId, width] of Object.entries(config?.columnWidths ?? {})) {
      const fieldName = fieldNameById.get(Number(fieldId));
      if (!fieldName) {
        continue;
      }
      columnWidths[fieldName] = Number(width);
    }

    return {
      columnWidths,
      sort: (config?.sort ?? [])
        .map((entry) => {
          const fieldName = entry.field.startsWith("data.")
            ? entry.field.slice(5)
            : entry.field;
          return fieldName
            ? {
                field: fieldName,
                order: entry.order,
                emptyPlacement: entry.emptyPlacement === "first" ? "first" : "last",
              }
            : null;
        })
        .filter(
          (
            entry,
          ): entry is {
            field: string;
            order: 1 | -1;
            emptyPlacement: "first" | "last";
          } => entry !== null,
        ),
      selectedFields,
    };
  }

  if (viewType === "kanban") {
    return {
      groupingField:
        typeof config?.groupingFieldId === "number"
          ? (fieldNameById.get(config.groupingFieldId) ?? null)
          : null,
      columnOrder: [...(config?.kanbanColumnOrder ?? [])],
      selectedFields,
    };
  }

  return {
    dateField: (() => {
      if (typeof config?.calendarDateFieldId === "number") {
        const fieldName = fieldNameById.get(config.calendarDateFieldId);
        if (fieldName) {
          return fieldName;
        }
      }

      if (
        typeof config?.calendarDateField === "string" &&
        config.calendarDateField.trim()
      ) {
        return config.calendarDateField.trim();
      }

      return null;
    })(),
    selectedFields,
  };
}

function buildArchiveItems(
  fields: Field[],
  itemRows: ItemRow[],
): FullArchiveItem[] {
  const orderedFields = [...fields].sort((a, b) => {
    if (a.order_index !== b.order_index) {
      return a.order_index - b.order_index;
    }
    return a.id - b.id;
  });

  return itemRows.map((row) => {
    let parsedData: Record<string, string | number | null> = {};
    try {
      const raw = JSON.parse(row.data) as unknown;
      if (raw && typeof raw === "object" && !Array.isArray(raw)) {
        parsedData = raw as Record<string, string | number | null>;
      }
    } catch {
      parsedData = {};
    }

    const data: FullArchiveItemData = {};
    for (const field of orderedFields) {
      if (!isSupportedFieldType(field.type)) {
        continue;
      }
      data[field.name] = toArchiveItemValue(field.type, parsedData[field.name]);
    }

    return {
      order: toNumber(row.order),
      data,
    };
  });
}

export function getArchiveDatabaseSummary(
  database: Database.Database,
): FullArchiveDatabaseSummary {
  const collectionCount = database
    .prepare("SELECT COUNT(*) AS count FROM collections")
    .get() as CountRow;
  const fieldCount = database
    .prepare("SELECT COUNT(*) AS count FROM fields")
    .get() as CountRow;
  const itemCount = database
    .prepare("SELECT COUNT(*) AS count FROM items")
    .get() as CountRow;
  const collectionNames = selectCollections(database).map(
    (collection) => collection.name,
  );

  return {
    isEmpty: toNumber(collectionCount.count) === 0,
    collectionCount: toNumber(collectionCount.count),
    totalFieldCount: toNumber(fieldCount.count),
    totalItemCount: toNumber(itemCount.count),
    collectionNames,
  };
}

export function exportFullArchive(
  database: Database.Database,
  input: { appVersion: string; description: string },
): FullArchiveFile {
  const exportedAt = new Date().toISOString();
  const collectionRows = selectCollections(database);
  const collections: FullArchiveCollection[] = collectionRows.map(
    (collection) => {
      const fields = selectFields(database, collection.id);
      const views = selectViews(database, collection.id);
      const items = selectItems(database, collection.id);

      const archiveFields: FullArchiveField[] = fields.map((field) => ({
        name: field.name,
        type: field.type,
        description: field.description ?? null,
        orderIndex: field.order_index,
        options: isSupportedFieldType(field.type)
          ? normalizeArchiveFieldOptions(field.type, field.options)
          : parseJsonObject(field.options),
      }));

      const archiveViews: FullArchiveView[] = views.map((view) => ({
        name: view.name,
        type: view.type,
        isDefault: toNumber(view.is_default) === 1,
        order: toNumber(view.order),
        config: isSupportedViewType(view.type)
          ? buildArchiveViewConfig(
              view.type,
              parseStoredViewConfig(view.config),
              fields,
            )
          : {},
      }));

      const archiveItems = buildArchiveItems(fields, items);

      return {
        name: collection.name,
        exportedAt,
        stats: {
          fieldCount: archiveFields.length,
          itemCount: archiveItems.length,
        },
        fields: archiveFields,
        views: archiveViews,
        items: archiveItems,
      };
    },
  );

  const totalFieldCount = collections.reduce(
    (sum, collection) => sum + collection.stats.fieldCount,
    0,
  );
  const totalItemCount = collections.reduce(
    (sum, collection) => sum + collection.stats.itemCount,
    0,
  );

  return {
    type: "full_archive",
    version: 1,
    appVersion: input.appVersion,
    exportedAt,
    description: input.description,
    stats: {
      collectionCount: collections.length,
      totalFieldCount,
      totalItemCount,
    },
    collections,
  };
}

function rebuildCollectionFtsIndex(
  database: Database.Database,
  collectionId: number,
): void {
  database
    .prepare(
      "DELETE FROM items_fts WHERE rowid IN (SELECT id FROM items WHERE collection_id = ?)",
    )
    .run(collectionId);
  database
    .prepare(
      `
      INSERT INTO items_fts(rowid, content)
      SELECT
        i.id,
        COALESCE(
          (
            SELECT group_concat(CAST(value AS TEXT), ' ')
            FROM json_each(i.data)
            WHERE json_each.type IN ('text', 'integer', 'real')
          ),
          ''
        )
      FROM items i
      WHERE i.collection_id = ?
      `,
    )
    .run(collectionId);
}

function pushDroppedReference(
  droppedViewReferences: FullArchiveDroppedViewReferenceWarning[],
  warning: FullArchiveDroppedViewReferenceWarning,
) {
  droppedViewReferences.push(warning);
}

function resolveSelectedFieldIds(
  collectionName: string,
  viewName: string,
  viewType: string,
  selectedFields: string[],
  fieldIdByName: Map<string, number>,
  droppedViewReferences: FullArchiveDroppedViewReferenceWarning[],
): number[] {
  const resolved: number[] = [];

  for (const fieldName of selectedFields) {
    const fieldId = fieldIdByName.get(fieldName);
    if (!fieldId) {
      pushDroppedReference(droppedViewReferences, {
        collectionName,
        viewName,
        viewType,
        referenceType: "selectedField",
        referenceValue: fieldName,
        reason: "Field not found during restore.",
      });
      continue;
    }
    resolved.push(fieldId);
  }

  return resolved;
}

function buildStoredViewConfig(
  collectionName: string,
  view: FullArchiveView,
  orderedFieldIds: number[],
  fieldIdByName: Map<string, number>,
  droppedViewReferences: FullArchiveDroppedViewReferenceWarning[],
): Record<string, unknown> | null {
  if (view.type === "grid") {
    const validated = FullArchiveGridViewConfigSchema.safeParse(view.config);
    if (!validated.success) {
      return null;
    }

    const columnWidths: Record<number, number> = {};
    for (const [fieldName, width] of Object.entries(
      validated.data.columnWidths,
    )) {
      const fieldId = fieldIdByName.get(fieldName);
      if (!fieldId) {
        pushDroppedReference(droppedViewReferences, {
          collectionName,
          viewName: view.name,
          viewType: view.type,
          referenceType: "columnWidth",
          referenceValue: fieldName,
          reason: "Field not found during restore.",
        });
        continue;
      }
      columnWidths[fieldId] = width;
    }

    const sort = validated.data.sort
      .map((entry) => {
        const fieldId = fieldIdByName.get(entry.field);
        if (!fieldId) {
          pushDroppedReference(droppedViewReferences, {
            collectionName,
            viewName: view.name,
            viewType: view.type,
            referenceType: "sort",
            referenceValue: entry.field,
            reason: "Field not found during restore.",
          });
          return null;
        }

        return {
          field: `data.${entry.field}`,
          order: entry.order,
          emptyPlacement: entry.emptyPlacement,
        };
      })
      .filter(
        (
          entry,
        ): entry is {
          field: string;
          order: 1 | -1;
          emptyPlacement: "first" | "last";
        } => entry !== null,
      );

    const selectedFieldIds = resolveSelectedFieldIds(
      collectionName,
      view.name,
      view.type,
      validated.data.selectedFields,
      fieldIdByName,
      droppedViewReferences,
    );

    return {
      columnWidths,
      sort,
      selectedFieldIds:
        selectedFieldIds.length > 0 ? selectedFieldIds : orderedFieldIds,
    };
  }

  if (view.type === "kanban") {
    const validated = FullArchiveKanbanViewConfigSchema.safeParse(view.config);
    if (!validated.success) {
      return null;
    }

    const groupingFieldId = validated.data.groupingField
      ? fieldIdByName.get(validated.data.groupingField)
      : undefined;
    if (validated.data.groupingField && !groupingFieldId) {
      pushDroppedReference(droppedViewReferences, {
        collectionName,
        viewName: view.name,
        viewType: view.type,
        referenceType: "groupingField",
        referenceValue: validated.data.groupingField,
        reason: "Field not found during restore.",
      });
    }

    const selectedFieldIds = resolveSelectedFieldIds(
      collectionName,
      view.name,
      view.type,
      validated.data.selectedFields,
      fieldIdByName,
      droppedViewReferences,
    );

    return {
      columnWidths: {},
      sort: [],
      groupingFieldId,
      kanbanColumnOrder: [...validated.data.columnOrder],
      selectedFieldIds:
        selectedFieldIds.length > 0 ? selectedFieldIds : orderedFieldIds,
    };
  }

  const validated = FullArchiveCalendarViewConfigSchema.safeParse(view.config);
  if (!validated.success) {
    return null;
  }

  const calendarDateFieldId = validated.data.dateField
    ? fieldIdByName.get(validated.data.dateField)
    : undefined;
  if (validated.data.dateField && !calendarDateFieldId) {
    pushDroppedReference(droppedViewReferences, {
      collectionName,
      viewName: view.name,
      viewType: view.type,
      referenceType: "dateField",
      referenceValue: validated.data.dateField,
      reason: "Field not found during restore.",
    });
  }

  const selectedFieldIds = resolveSelectedFieldIds(
    collectionName,
    view.name,
    view.type,
    validated.data.selectedFields,
    fieldIdByName,
    droppedViewReferences,
  );

  return {
    columnWidths: {},
    sort: [],
    calendarDateFieldId,
    selectedFieldIds:
      selectedFieldIds.length > 0 ? selectedFieldIds : orderedFieldIds,
  };
}

function ensureFallbackSourceView(
  database: Database.Database,
  collectionId: number,
  orderedFieldIds: number[],
): void {
  const row = database
    .prepare(
      "SELECT id FROM views WHERE collection_id = ? AND is_default = 1 LIMIT 1",
    )
    .get(collectionId) as { id: number } | undefined;
  if (row) {
    return;
  }

  const config = {
    columnWidths: {},
    sort: [],
    selectedFieldIds: orderedFieldIds,
  };
  database
    .prepare(
      'INSERT INTO views (collection_id, name, type, is_default, "order", config) VALUES (?, ?, ?, ?, ?, ?)',
    )
    .run(collectionId, "Source", "grid", 1, 0, JSON.stringify(config));
}

function countRows(
  database: Database.Database,
  tableName: "collections" | "fields" | "items",
): number {
  const row = database
    .prepare(`SELECT COUNT(*) AS count FROM ${tableName}`)
    .get() as CountRow;
  return toNumber(row.count);
}

export function restoreFullArchive(
  database: Database.Database,
  archive: FullArchiveFile,
  ftsEnabled: boolean,
): Omit<FullArchiveRestoreReport, "preRestoreBackupPath"> {
  const restoredCollections: string[] = [];
  const failedCollections: Array<{
    collectionName: string;
    message: string;
  }> = [];
  const skippedEntities: FullArchiveSkippedEntityWarning[] = [];
  const droppedViewReferences: FullArchiveDroppedViewReferenceWarning[] = [];
  const statMismatches: FullArchiveStatMismatch[] = [];
  const restoredCollectionIds: Array<{
    sourceIndex: number;
    collectionName: string;
    collectionId: number;
  }> = [];

  database.prepare("DELETE FROM collections").run();

  for (const [sourceIndex, collection] of archive.collections.entries()) {
    const restoreCollection = database.transaction(() => {
      const collectionInfo = database
        .prepare("INSERT INTO collections (name, icon) VALUES (?, ?)")
        .run(collection.name, "folder");
      const collectionId = Number(collectionInfo.lastInsertRowid);

      const insertField = database.prepare(
        "INSERT INTO fields (collection_id, name, type, description, options, order_index) VALUES (?, ?, ?, ?, ?, ?)",
      );
      const fieldIdByName = new Map<string, number>();

      const orderedArchiveFields = [...collection.fields].sort((a, b) => {
        if (a.orderIndex !== b.orderIndex) {
          return a.orderIndex - b.orderIndex;
        }
        return a.name.localeCompare(b.name);
      });

      for (const field of orderedArchiveFields) {
        if (!isSupportedFieldType(field.type)) {
          skippedEntities.push({
            scope: "field",
            collectionName: collection.name,
            name: field.name,
            type: field.type,
            reason: "Unknown field type.",
          });
          continue;
        }
        if (!isSafeFieldName(field.name)) {
          skippedEntities.push({
            scope: "field",
            collectionName: collection.name,
            name: field.name,
            type: field.type,
            reason: "Unsafe field name.",
          });
          continue;
        }

        const info = insertField.run(
          collectionId,
          field.name,
          field.type,
          field.description ?? null,
          field.options ? JSON.stringify(field.options) : null,
          field.orderIndex,
        );
        fieldIdByName.set(field.name, Number(info.lastInsertRowid));
      }

      const validFields = selectFields(database, collectionId).filter((field) =>
        isSupportedFieldType(field.type),
      );
      const orderedFieldIds = validFields.map((field) => field.id);

      const insertItem = database.prepare(
        'INSERT INTO items (collection_id, data, "order") VALUES (?, ?, ?)',
      );

      for (const item of [...collection.items].sort(
        (a, b) => a.order - b.order,
      )) {
        const nextItemData: ItemData = {};
        for (const field of validFields) {
          nextItemData[field.name] = toStoredItemValue(
            field.type as FieldType,
            item.data[field.name],
          );
        }
        insertItem.run(collectionId, JSON.stringify(nextItemData), item.order);
      }

      if (ftsEnabled) {
        rebuildCollectionFtsIndex(database, collectionId);
      }

      const insertView = database.prepare(
        'INSERT INTO views (collection_id, name, type, is_default, "order", config) VALUES (?, ?, ?, ?, ?, ?)',
      );
      const orderedViews = [...collection.views].sort((a, b) => {
        if (a.order !== b.order) {
          return a.order - b.order;
        }
        return a.name.localeCompare(b.name);
      });

      for (const view of orderedViews) {
        if (!isSupportedViewType(view.type)) {
          skippedEntities.push({
            scope: "view",
            collectionName: collection.name,
            name: view.name,
            type: view.type,
            reason: "Unknown view type.",
          });
          continue;
        }

        const storedConfig = buildStoredViewConfig(
          collection.name,
          view,
          orderedFieldIds,
          fieldIdByName,
          droppedViewReferences,
        );

        insertView.run(
          collectionId,
          view.name,
          view.type,
          view.isDefault ? 1 : 0,
          view.order,
          storedConfig ? JSON.stringify(storedConfig) : null,
        );
      }

      ensureFallbackSourceView(database, collectionId, orderedFieldIds);
      restoredCollectionIds.push({
        sourceIndex,
        collectionName: collection.name,
        collectionId,
      });
      restoredCollections.push(collection.name);
    });

    try {
      restoreCollection();
    } catch (error) {
      failedCollections.push({
        collectionName: collection.name,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const totalCollections = countRows(database, "collections");
  const totalFields = countRows(database, "fields");
  const totalItems = countRows(database, "items");

  if (totalCollections !== archive.stats.collectionCount) {
    statMismatches.push({
      scope: "total",
      stat: "collectionCount",
      expected: archive.stats.collectionCount,
      actual: totalCollections,
    });
  }
  if (totalFields !== archive.stats.totalFieldCount) {
    statMismatches.push({
      scope: "total",
      stat: "fieldCount",
      expected: archive.stats.totalFieldCount,
      actual: totalFields,
    });
  }
  if (totalItems !== archive.stats.totalItemCount) {
    statMismatches.push({
      scope: "total",
      stat: "itemCount",
      expected: archive.stats.totalItemCount,
      actual: totalItems,
    });
  }

  for (let index = 0; index < archive.collections.length; index += 1) {
    const sourceCollection = archive.collections[index];
    const restoredCollection = restoredCollectionIds.find(
      (entry) => entry.sourceIndex === index,
    );
    if (!restoredCollection) {
      continue;
    }

    const fieldCountRow = database
      .prepare("SELECT COUNT(*) AS count FROM fields WHERE collection_id = ?")
      .get(restoredCollection.collectionId) as CountRow;
    const itemCountRow = database
      .prepare("SELECT COUNT(*) AS count FROM items WHERE collection_id = ?")
      .get(restoredCollection.collectionId) as CountRow;

    const actualFieldCount = toNumber(fieldCountRow.count);
    const actualItemCount = toNumber(itemCountRow.count);

    if (actualFieldCount !== sourceCollection.stats.fieldCount) {
      statMismatches.push({
        scope: "collection",
        collectionName: sourceCollection.name,
        stat: "fieldCount",
        expected: sourceCollection.stats.fieldCount,
        actual: actualFieldCount,
      });
    }
    if (actualItemCount !== sourceCollection.stats.itemCount) {
      statMismatches.push({
        scope: "collection",
        collectionName: sourceCollection.name,
        stat: "itemCount",
        expected: sourceCollection.stats.itemCount,
        actual: actualItemCount,
      });
    }
  }

  return {
    restoredCollections,
    failedCollections,
    skippedEntities,
    droppedViewReferences,
    statMismatches,
  };
}

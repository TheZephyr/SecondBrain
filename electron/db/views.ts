import Database from "better-sqlite3";
import type { ReorderViewsInput, ViewConfig } from "../../src/types/models";
import { ViewConfigSchema } from "../../src/validation/schemas";
import { toNumber } from "./query-utils";

type MaxViewOrderRow = { maxOrder: number | bigint | null };
type ViewConfigRow = { config: string | null };
type IdRow = { id: number };

export function parseStoredViewConfig(
  config: string | null,
): ViewConfig | null {
  if (!config) {
    return null;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(config);
  } catch {
    return null;
  }

  const validated = ViewConfigSchema.safeParse(parsed);
  if (!validated.success) {
    return null;
  }

  const columnWidths = Object.fromEntries(
    Object.entries(validated.data.columnWidths).map(([fieldId, width]) => [
      Number(fieldId),
      width,
    ]),
  ) as Record<number, number>;

  const result: ViewConfig = {
    columnWidths,
    sort: validated.data.sort.map((entry) => ({
      field: entry.field,
      order: entry.order,
      emptyPlacement: entry.emptyPlacement,
    })),
    calendarDateField: validated.data.calendarDateField,
    calendarDateFieldId: validated.data.calendarDateFieldId,
    groupingFieldId: validated.data.groupingFieldId,
    kanbanColumnOrder: validated.data.kanbanColumnOrder,
    selectedFieldIds: validated.data.selectedFieldIds,
  };
  if (validated.data.cardTitleFieldId !== undefined) {
    result.cardTitleFieldId = validated.data.cardTitleFieldId;
  }
  return result;
}

function assertNotSourceView(
  database: Database.Database,
  viewId: number,
  action: string,
) {
  const row = database
    .prepare("SELECT is_default FROM views WHERE id = ?")
    .get(viewId) as { is_default: number | bigint } | undefined;

  if (!row) {
    throw new Error(`View ${viewId} not found.`);
  }

  if (toNumber(row.is_default) === 1) {
    throw new Error(`Cannot ${action} source view ${viewId}.`);
  }
}

function getNextViewOrderIndex(
  database: Database.Database,
  collectionId: number,
): number {
  const row = database
    .prepare(
      'SELECT MAX("order") AS maxOrder FROM views WHERE collection_id = ?',
    )
    .get(collectionId) as MaxViewOrderRow | undefined;

  const maxOrder =
    row?.maxOrder === null || row?.maxOrder === undefined
      ? -1
      : toNumber(row.maxOrder);
  return maxOrder + 1;
}

function ensureViewReorderPayloadMatchesCollection(
  database: Database.Database,
  input: ReorderViewsInput,
) {
  const sourceRow = database
    .prepare(
      "SELECT id FROM views WHERE collection_id = ? AND is_default = 1 LIMIT 1",
    )
    .get(input.collectionId) as IdRow | undefined;

  if (sourceRow) {
    const includesSource = input.viewOrders.some(
      (entry) => entry.id === sourceRow.id,
    );
    if (includesSource) {
      throw new Error(
        `View reorder payload includes source view ${sourceRow.id} for collection ${input.collectionId}.`,
      );
    }
  }

  const viewRows = database
    .prepare(
      'SELECT id FROM views WHERE collection_id = ? AND is_default = 0 ORDER BY "order" ASC, id ASC',
    )
    .all(input.collectionId) as IdRow[];

  if (viewRows.length !== input.viewOrders.length) {
    throw new Error(
      `View reorder payload must include every non-source view in collection ${input.collectionId} exactly once.`,
    );
  }

  const existingIds = new Set(viewRows.map((row) => row.id));
  const payloadIds = input.viewOrders.map((entry) => entry.id);
  const payloadUniqueIds = new Set(payloadIds);
  if (payloadUniqueIds.size !== payloadIds.length) {
    throw new Error(
      `View reorder payload contains duplicate view IDs for collection ${input.collectionId}.`,
    );
  }

  const invalidIds: number[] = [];
  for (const payloadId of payloadUniqueIds) {
    if (!existingIds.has(payloadId)) {
      invalidIds.push(payloadId);
    }
  }

  if (invalidIds.length > 0) {
    throw new Error(
      `View reorder payload contains IDs outside collection ${input.collectionId}: ${invalidIds.join(", ")}`,
    );
  }

  const missingIds: number[] = [];
  for (const existingId of existingIds) {
    if (!payloadUniqueIds.has(existingId)) {
      missingIds.push(existingId);
    }
  }

  if (missingIds.length > 0) {
    throw new Error(
      `View reorder payload is missing IDs from collection ${input.collectionId}: ${missingIds.join(", ")}`,
    );
  }
}

export function getViews(database: Database.Database, collectionId: number) {
  return database
    .prepare(
      'SELECT * FROM views WHERE collection_id = ? ORDER BY "order" ASC, id ASC',
    )
    .all(collectionId);
}

export function addView(
  database: Database.Database,
  input: {
    collectionId: number;
    name: string;
    type?: string;
    isDefault?: number;
    order?: number;
  },
) {
  const type = input.type ?? "grid";
  const isDefault = input.isDefault ?? 0;
  const order =
    input.order ?? getNextViewOrderIndex(database, input.collectionId);
  const info = database
    .prepare(
      'INSERT INTO views (collection_id, name, type, is_default, "order") VALUES (?, ?, ?, ?, ?)',
    )
    .run(input.collectionId, input.name, type, isDefault, order);

  return {
    id: Number(info.lastInsertRowid),
    collection_id: input.collectionId,
    name: input.name,
    type,
    is_default: isDefault,
    order,
  };
}

export function updateView(
  database: Database.Database,
  input: { id: number; name: string },
) {
  assertNotSourceView(database, input.id, "rename");
  const info = database
    .prepare("UPDATE views SET name = ? WHERE id = ?")
    .run(input.name, input.id);

  if (toNumber(info.changes) !== 1) {
    throw new Error(`Failed to update view ${input.id}.`);
  }

  return true;
}

export function deleteView(database: Database.Database, viewId: number) {
  assertNotSourceView(database, viewId, "delete");
  const info = database.prepare("DELETE FROM views WHERE id = ?").run(viewId);

  if (toNumber(info.changes) !== 1) {
    throw new Error(`Failed to delete view ${viewId}.`);
  }

  return true;
}

export function getViewConfig(database: Database.Database, viewId: number) {
  const row = database
    .prepare("SELECT config FROM views WHERE id = ?")
    .get(viewId) as ViewConfigRow | undefined;

  if (!row) {
    return null;
  }

  return parseStoredViewConfig(row.config);
}

export function updateViewConfig(
  database: Database.Database,
  input: { viewId: number; config: ViewConfig },
) {
  const payload: ViewConfig = {
    columnWidths: Object.fromEntries(
      Object.entries(input.config.columnWidths).map(([fieldId, width]) => [
        Number(fieldId),
        width,
      ]),
    ) as Record<number, number>,
    sort: input.config.sort.map((entry) => ({
      field: entry.field,
      order: entry.order,
      emptyPlacement: entry.emptyPlacement === "first" ? "first" : "last",
    })),
    calendarDateField: input.config.calendarDateField,
    calendarDateFieldId: input.config.calendarDateFieldId,
    groupingFieldId: input.config.groupingFieldId,
    kanbanColumnOrder: input.config.kanbanColumnOrder,
    selectedFieldIds: input.config.selectedFieldIds,
  };
  if (input.config.cardTitleFieldId !== undefined) {
    payload.cardTitleFieldId = input.config.cardTitleFieldId;
  }
  const info = database
    .prepare("UPDATE views SET config = ? WHERE id = ?")
    .run(JSON.stringify(payload), input.viewId);

  if (toNumber(info.changes) !== 1) {
    throw new Error(`Failed to update view config for view ${input.viewId}.`);
  }

  return true;
}

export function reorderViews(
  database: Database.Database,
  input: ReorderViewsInput,
): boolean {
  const reorderViewsTransaction = database.transaction(
    (payload: ReorderViewsInput) => {
      ensureViewReorderPayloadMatchesCollection(database, payload);

      const shiftAmount = payload.viewOrders.length + 1;
      database
        .prepare(
          'UPDATE views SET "order" = "order" + ? WHERE collection_id = ?',
        )
        .run(shiftAmount, payload.collectionId);

      database
        .prepare(
          'UPDATE views SET "order" = 0 WHERE collection_id = ? AND is_default = 1',
        )
        .run(payload.collectionId);

      const updateViewOrder = database.prepare(
        'UPDATE views SET "order" = ? WHERE id = ? AND collection_id = ? AND is_default = 0',
      );

      for (const entry of payload.viewOrders) {
        const info = updateViewOrder.run(
          entry.order,
          entry.id,
          payload.collectionId,
        );
        if (toNumber(info.changes) !== 1) {
          throw new Error(
            `Failed to reorder view ${entry.id} in collection ${payload.collectionId}.`,
          );
        }
      }
    },
  );

  reorderViewsTransaction(input);
  return true;
}

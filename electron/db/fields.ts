import Database from "better-sqlite3";
import type { ReorderFieldsInput } from "../../src/types/models";
import { toNumber } from "./query-utils";

type MaxOrderRow = { maxOrderIndex: number | bigint | null };
type IdRow = { id: number };

export function getNextFieldOrderIndex(
  database: Database.Database,
  collectionId: number,
): number {
  const row = database
    .prepare(
      "SELECT MAX(order_index) AS maxOrderIndex FROM fields WHERE collection_id = ?",
    )
    .get(collectionId) as MaxOrderRow | undefined;

  const maxOrderIndex =
    row?.maxOrderIndex === null || row?.maxOrderIndex === undefined
      ? -1
      : toNumber(row.maxOrderIndex);
  return maxOrderIndex + 1;
}

export function getFields(database: Database.Database, collectionId: number) {
  return database
    .prepare(
      "SELECT * FROM fields WHERE collection_id = ? ORDER BY order_index ASC",
    )
    .all(collectionId);
}

export function addField(
  database: Database.Database,
  input: {
    collectionId: number;
    name: string;
    type: string;
    description?: string | null;
    options?: string | null;
    orderIndex?: number;
  },
) {
  const orderIndex =
    input.orderIndex ?? getNextFieldOrderIndex(database, input.collectionId);
  const info = database
    .prepare(
      "INSERT INTO fields (collection_id, name, type, description, options, order_index) VALUES (?, ?, ?, ?, ?, ?)",
    )
    .run(
      input.collectionId,
      input.name,
      input.type,
      input.description ?? null,
      input.options || null,
      orderIndex,
    );

  return {
    id: Number(info.lastInsertRowid),
    ...input,
    orderIndex,
  };
}

export function updateField(
  database: Database.Database,
  input: {
    id: number;
    name: string;
    type: string;
    description?: string | null;
    options?: string | null;
    orderIndex?: number;
  },
) {
  // Get current field to detect name changes
  const currentField = database
    .prepare("SELECT name, collection_id FROM fields WHERE id = ?")
    .get(input.id) as { name: string; collection_id: number } | undefined;

  if (!currentField) {
    throw new Error(`Field ${input.id} not found.`);
  }

  const oldName = currentField.name;
  const newName = input.name;
  const collectionId = currentField.collection_id;
  const nameChanged = oldName !== newName;

  // Use transaction to ensure atomicity: field rename + data migration
  const updateFieldTransaction = database.transaction(() => {
    // Update the field
      database
        .prepare(
          "UPDATE fields SET name = ?, type = ?, description = ?, options = ?, order_index = ? WHERE id = ?",
        )
        .run(
          newName,
          input.type,
          input.description ?? null,
          input.options || null,
          input.orderIndex || 0,
          input.id,
      );

    // If name changed, migrate all item data in the collection
    if (nameChanged) {
      database
        .prepare(
          `
          UPDATE items
          SET data = json_set(
            json_remove(data, '$."${oldName}"'),
            '$."${newName}"',
            json_extract(data, '$."${oldName}"')
          )
          WHERE collection_id = ?
            AND json_type(data, '$."${oldName}"') IS NOT NULL
        `,
        )
        .run(collectionId);
    }
  });

  updateFieldTransaction();
  return true;
}

export function deleteField(database: Database.Database, fieldId: number) {
  database.prepare("DELETE FROM fields WHERE id = ?").run(fieldId);
  return true;
}

function ensureReorderPayloadMatchesCollection(
  database: Database.Database,
  input: ReorderFieldsInput,
) {
  const fieldRows = database
    .prepare(
      "SELECT id FROM fields WHERE collection_id = ? ORDER BY order_index ASC, id ASC",
    )
    .all(input.collectionId) as IdRow[];

  if (fieldRows.length !== input.fieldOrders.length) {
    throw new Error(
      "Field reorder payload must include every field in the collection exactly once.",
    );
  }

  const existingIds = new Set(fieldRows.map((row) => row.id));
  const payloadIds = input.fieldOrders.map((entry) => entry.id);
  const payloadUniqueIds = new Set(payloadIds);
  if (payloadUniqueIds.size !== payloadIds.length) {
    throw new Error("Field reorder payload contains duplicate field IDs.");
  }

  const invalidIds: number[] = [];
  for (const payloadId of payloadUniqueIds) {
    if (!existingIds.has(payloadId)) {
      invalidIds.push(payloadId);
    }
  }

  if (invalidIds.length > 0) {
    throw new Error(
      `Field reorder payload contains IDs outside the collection: ${invalidIds.join(", ")}`,
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
      `Field reorder payload is missing IDs from the collection: ${missingIds.join(", ")}`,
    );
  }
}

export function reorderFields(
  database: Database.Database,
  input: ReorderFieldsInput,
): boolean {
  const reorderFieldsTransaction = database.transaction(
    (payload: ReorderFieldsInput) => {
      ensureReorderPayloadMatchesCollection(database, payload);

      const shiftAmount = payload.fieldOrders.length;
      database
        .prepare(
          "UPDATE fields SET order_index = order_index + ? WHERE collection_id = ?",
        )
        .run(shiftAmount, payload.collectionId);

      const updateFieldOrder = database.prepare(
        "UPDATE fields SET order_index = ? WHERE id = ? AND collection_id = ?",
      );

      for (const entry of payload.fieldOrders) {
        const info = updateFieldOrder.run(
          entry.orderIndex,
          entry.id,
          payload.collectionId,
        );
        if (toNumber(info.changes) !== 1) {
          throw new Error(
            `Failed to reorder field ${entry.id} in collection ${payload.collectionId}.`,
          );
        }
      }
    },
  );

  reorderFieldsTransaction(input);
  return true;
}

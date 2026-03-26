import Database from "better-sqlite3";

export function getCollections(database: Database.Database) {
  return database
    .prepare("SELECT * FROM collections ORDER BY created_at ASC, id ASC")
    .all();
}

export function getCollectionItemCounts(database: Database.Database) {
  return database
    .prepare(
      "SELECT collection_id AS collectionId, COUNT(*) AS itemCount FROM items GROUP BY collection_id",
    )
    .all();
}

export function addCollection(database: Database.Database, input: { name: string; icon?: string | null }) {
  const createCollection = database.transaction(() => {
    const stmt = database.prepare(
      "INSERT INTO collections (name, icon) VALUES (?, ?)",
    );
    const info = stmt.run(
      input.name,
      input.icon || "folder",
    );
    const collectionId = Number(info.lastInsertRowid);

    database
      .prepare(
        'INSERT INTO views (collection_id, name, type, is_default, "order") VALUES (?, ?, ?, ?, ?)',
      )
      .run(collectionId, "Source", "grid", 1, 0);

    return {
      id: collectionId,
      name: input.name,
    };
  });

  return createCollection();
}

export function updateCollection(database: Database.Database, input: { id: number; name: string; icon?: string | null }) {
  database
    .prepare("UPDATE collections SET name = ?, icon = ? WHERE id = ?")
    .run(input.name, input.icon, input.id);
  return true;
}

export function deleteCollection(database: Database.Database, collectionId: number) {
  const deleteTx = database.transaction((id: number) => {
    database
      .prepare("DELETE FROM collections WHERE id = ?")
      .run(id);
  });

  deleteTx(collectionId);
  return true;
}

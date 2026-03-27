import Database from "better-sqlite3";
import type { ItemSortSpec } from "../../src/types/models";

export function toNumber(value: number | bigint | undefined): number {
  if (value === undefined) return 0;
  return typeof value === "bigint" ? Number(value) : value;
}

export function tokenizeSearch(search: string | undefined): string[] {
  if (!search) return [];
  return search
    .trim()
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 0);
}

export function escapeLikePattern(token: string): string {
  return token.replace(/([\\%_])/g, "\\$1");
}

export function buildFtsMatchQuery(tokens: string[]): string {
  return tokens.map((token) => `"${token.replace(/"/g, '""')}"`).join(" AND ");
}

export function extractSortableFieldName(path: string): string | null {
  if (!path.startsWith("data.")) return null;
  const fieldName = path.slice(5).trim();
  if (!fieldName) return null;
  return fieldName;
}

export function getFieldTypeMap(
  database: Database.Database,
  collectionId: number,
): Map<string, string> {
  const rows = database
    .prepare("SELECT name, type FROM fields WHERE collection_id = ?")
    .all(collectionId) as { name: string; type: string }[];
  return new Map(rows.map((row) => [row.name, row.type]));
}

export function getItemSortClause(
  sort: ItemSortSpec[] | undefined,
  fieldTypeMap: Map<string, string>,
): string[] {
  if (!sort || sort.length === 0) {
    return [];
  }

  const clauses: string[] = [];

  for (const spec of sort) {
    const fieldName = extractSortableFieldName(spec.field);
    if (!fieldName) {
      continue;
    }

    const direction = spec.order === -1 ? "DESC" : "ASC";
    const jsonPath = `$."${fieldName.replace(/"/g, '""')}"`;
    const fieldType = fieldTypeMap.get(fieldName);

    if (fieldType === "multiselect") {
      clauses.push(
        `json_extract(json_extract(i.data, '${jsonPath}'), '$[0]') COLLATE NOCASE ${direction}`,
      );
      continue;
    }

    if (fieldType === "boolean") {
      clauses.push(
        `CASE WHEN json_extract(i.data, '${jsonPath}') IN ('1', 1, true) THEN 1 ELSE 0 END ${direction}`,
      );
      continue;
    }

    if (fieldType === "rating") {
      clauses.push(
        `CASE WHEN json_extract(i.data, '${jsonPath}') IS NULL OR json_extract(i.data, '${jsonPath}') = '' THEN 1 ELSE 0 END ASC`,
      );
      clauses.push(
        `CAST(json_extract(i.data, '${jsonPath}') AS REAL) ${direction}`,
      );
      continue;
    }

    clauses.push(
      `json_extract(i.data, '${jsonPath}') COLLATE NOCASE ${direction}`,
    );
  }

  return clauses;
}

export function buildSearchQueryContext(
  input: { collectionId: number; search?: string },
  fieldTypeMap: Map<string, string>,
  ftsEnabled: boolean,
): {
  joinClause: string;
  whereClause: string;
  params: unknown[];
  defaultOrderClause: string;
} {
  const whereParts: string[] = ["i.collection_id = ?"];
  const params: unknown[] = [input.collectionId];
  let joinClause = "";
  let defaultOrderClause = 'i."order" ASC, i.id ASC';
  const searchTokens = tokenizeSearch(input.search);
  const multiselectFields = [...fieldTypeMap.entries()]
    .filter(([, type]) => type === "multiselect")
    .map(([name]) => name);

  if (searchTokens.length === 0) {
    return {
      joinClause,
      whereClause: whereParts.join(" AND "),
      params,
      defaultOrderClause,
    };
  }

  if (ftsEnabled) {
    joinClause = "JOIN items_fts fts ON fts.rowid = i.id";
    whereParts.push("fts.content MATCH ?");
    params.push(buildFtsMatchQuery(searchTokens));
    defaultOrderClause = 'bm25(items_fts) ASC, i."order" ASC, i.id ASC';
    return {
      joinClause,
      whereClause: whereParts.join(" AND "),
      params,
      defaultOrderClause,
    };
  }

  for (const token of searchTokens) {
    const likeToken = `%${escapeLikePattern(token.toLowerCase())}%`;
    const multiselectToken = `%"${escapeLikePattern(token.toLowerCase())}%`;

    const multiselectClause =
      multiselectFields.length > 0
        ? ` OR (${multiselectFields
            .map((fieldName) => {
              const jsonPath = `$."${fieldName.replace(/"/g, '""')}"`;
              return `LOWER(json_extract(i.data, '${jsonPath}')) LIKE ? ESCAPE '\\\\'`;
            })
            .join(" OR ")})`
        : "";

    whereParts.push(`
      (
        EXISTS (
          SELECT 1
          FROM json_each(i.data) je
          WHERE je.type IN ('text', 'integer', 'real')
            AND LOWER(CAST(je.value AS TEXT)) LIKE ? ESCAPE '\\\\'
        )
        ${multiselectClause}
      )
    `);
    params.push(likeToken);
    if (multiselectFields.length > 0) {
      for (let i = 0; i < multiselectFields.length; i += 1) {
        params.push(multiselectToken);
      }
    }
  }

  return {
    joinClause,
    whereClause: whereParts.join(" AND "),
    params,
    defaultOrderClause,
  };
}

import Database from "better-sqlite3";
import { describe, expect, it } from "vitest";
import {
  buildFtsMatchQuery,
  buildSearchQueryContext,
  escapeLikePattern,
  extractSortableFieldName,
  getFieldTypeMap,
  getItemSortClause,
  toNumber,
  tokenizeSearch,
} from "../db/query-utils";

describe("query-utils", () => {
  describe("toNumber", () => {
    it("returns 0 for undefined", () => {
      expect(toNumber(undefined)).toBe(0);
    });

    it("returns the number unchanged", () => {
      expect(toNumber(42)).toBe(42);
    });

    it("converts bigint values", () => {
      expect(toNumber(42n)).toBe(42);
    });
  });

  describe("tokenizeSearch", () => {
    it("returns an empty array for empty input", () => {
      expect(tokenizeSearch(undefined)).toEqual([]);
      expect(tokenizeSearch("")).toEqual([]);
      expect(tokenizeSearch("   ")).toEqual([]);
    });

    it("splits on whitespace and trims tokens", () => {
      expect(tokenizeSearch("  hello   world \n second   ")).toEqual([
        "hello",
        "world",
        "second",
      ]);
    });
  });

  describe("escapeLikePattern", () => {
    it("escapes LIKE wildcards and backslashes", () => {
      expect(escapeLikePattern(String.raw`a\b%c_d`)).toBe(
        String.raw`a\\b\%c\_d`,
      );
    });
  });

  describe("buildFtsMatchQuery", () => {
    it("quotes tokens and escapes embedded quotes", () => {
      expect(buildFtsMatchQuery(['hello', 'a"b'])).toBe('"hello" AND "a""b"');
    });
  });

  describe("extractSortableFieldName", () => {
    it("returns null when the path is not a data field", () => {
      expect(extractSortableFieldName("title")).toBeNull();
    });

    it("returns the field name for data paths", () => {
      expect(extractSortableFieldName("data.Title")).toBe("Title");
    });

    it("returns null when the field name is empty", () => {
      expect(extractSortableFieldName("data.   ")).toBeNull();
    });
  });

  describe("getFieldTypeMap", () => {
    it("loads field types from sqlite", () => {
      const database = new Database(":memory:");
      try {
        database.exec(`
          CREATE TABLE fields (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            collection_id INTEGER NOT NULL,
            name TEXT NOT NULL,
            type TEXT NOT NULL
          );

          INSERT INTO fields (collection_id, name, type) VALUES
            (1, 'Title', 'text'),
            (1, 'Tags', 'multiselect'),
            (2, 'Ignored', 'boolean');
        `);

        expect(getFieldTypeMap(database, 1)).toEqual(
          new Map([
            ["Title", "text"],
            ["Tags", "multiselect"],
          ]),
        );
      } finally {
        database.close();
      }
    });
  });

  describe("getItemSortClause", () => {
    it("returns field-aware clauses for supported types", () => {
      const fieldTypeMap = new Map<string, string>([
        ["Tags", "multiselect"],
        ["Done", "boolean"],
        ["Rating", "rating"],
        ["Title", "text"],
      ]);

      expect(
        getItemSortClause(
          [
            { field: "data.Tags", order: 1, emptyPlacement: "first" },
            { field: "data.Done", order: -1, emptyPlacement: "last" },
            { field: "data.Rating", order: 1, emptyPlacement: "last" },
            { field: "data.Title", order: -1, emptyPlacement: "first" },
            { field: "other.Path", order: 1 },
          ],
          fieldTypeMap,
        ),
      ).toEqual([
        `CASE WHEN json_extract(json_extract(i.data, '$."Tags"'), '$[0]') IS NULL OR json_extract(json_extract(i.data, '$."Tags"'), '$[0]') = '' THEN 1 ELSE 0 END DESC`,
        `CASE WHEN CASE WHEN json_extract(json_extract(i.data, '$."Tags"'), '$[0]') IS NULL OR json_extract(json_extract(i.data, '$."Tags"'), '$[0]') = '' THEN 1 ELSE 0 END = 1 THEN NULL ELSE json_extract(json_extract(i.data, '$."Tags"'), '$[0]') END COLLATE NOCASE ASC`,
        `CASE WHEN json_type(i.data, '$."Done"') IS NULL THEN 1 ELSE 0 END ASC`,
        `CASE WHEN json_extract(i.data, '$."Done"') IN ('1', 1, true) THEN 1 ELSE 0 END DESC`,
        `CASE WHEN json_extract(i.data, '$."Rating"') IS NULL OR json_extract(i.data, '$."Rating"') = '' THEN 1 ELSE 0 END ASC`,
        `CAST(CASE WHEN CASE WHEN json_extract(i.data, '$."Rating"') IS NULL OR json_extract(i.data, '$."Rating"') = '' THEN 1 ELSE 0 END = 1 THEN NULL ELSE json_extract(i.data, '$."Rating"') END AS REAL) ASC`,
        `CASE WHEN json_extract(i.data, '$."Title"') IS NULL OR json_extract(i.data, '$."Title"') = '' THEN 1 ELSE 0 END DESC`,
        `CASE WHEN CASE WHEN json_extract(i.data, '$."Title"') IS NULL OR json_extract(i.data, '$."Title"') = '' THEN 1 ELSE 0 END = 1 THEN NULL ELSE json_extract(i.data, '$."Title"') END COLLATE NOCASE DESC`,
      ]);
    });

    it("returns an empty array when no sort is provided", () => {
      expect(getItemSortClause(undefined, new Map())).toEqual([]);
      expect(getItemSortClause([], new Map())).toEqual([]);
    });
  });

  describe("buildSearchQueryContext", () => {
    it("returns the default query context when search is empty", () => {
      expect(
        buildSearchQueryContext({ collectionId: 7 }, new Map(), true),
      ).toEqual({
        joinClause: "",
        whereClause: "i.collection_id = ?",
        params: [7],
        defaultOrderClause: 'i."order" ASC, i.id ASC',
      });
    });

    it("builds an FTS context when enabled", () => {
      expect(
        buildSearchQueryContext(
          { collectionId: 7, search: "alpha beta" },
          new Map([["Tags", "multiselect"]]),
          true,
        ),
      ).toEqual({
        joinClause: "JOIN items_fts fts ON fts.rowid = i.id",
        whereClause: "i.collection_id = ? AND fts.content MATCH ?",
        params: [7, '"alpha" AND "beta"'],
        defaultOrderClause: 'bm25(items_fts) ASC, i."order" ASC, i.id ASC',
      });
    });

    it("builds LIKE predicates and multiselect parameters when FTS is disabled", () => {
      const result = buildSearchQueryContext(
        { collectionId: 7, search: 'Hello a%b' },
        new Map([["Tags", "multiselect"]]),
        false,
      );

      expect(result.joinClause).toBe("");
      expect(result.whereClause).toContain("i.collection_id = ?");
      expect(result.whereClause).toContain("json_each(i.data)");
      expect(result.whereClause).toContain("LOWER(json_extract(i.data, '$.\"Tags\"')) LIKE ? ESCAPE '\\\\'");
      expect(result.params).toEqual([7, "%hello%", '%"hello%', "%a\\%b%", '%"a\\%b%']);
      expect(result.defaultOrderClause).toBe('i."order" ASC, i.id ASC');
    });
  });
});

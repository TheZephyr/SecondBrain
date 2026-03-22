import { describe, expect, it } from "vitest";
import {
  buildFullArchiveFileName,
  parseFullArchiveContent,
} from "../fullArchive";

describe("full archive utilities", () => {
  it("builds the expected archive filename", () => {
    const fileName = buildFullArchiveFileName(new Date(2026, 2, 22, 14, 30));

    expect(fileName).toBe("secondbrain_archive_2026-03-22_14-30.json");
  });

  it("parses a valid archive and ignores unknown keys", () => {
    const archive = parseFullArchiveContent(
      JSON.stringify({
        type: "full_archive",
        version: 1,
        appVersion: "0.3.0",
        exportedAt: "2026-03-22T14:30:00.000Z",
        description: "",
        stats: {
          collectionCount: 1,
          totalFieldCount: 1,
          totalItemCount: 1,
          unexpected: true,
        },
        collections: [
          {
            name: "Books",
            exportedAt: "2026-03-22T14:30:00.000Z",
            stats: {
              fieldCount: 1,
              itemCount: 1,
              extra: "ignored",
            },
            fields: [
              {
                name: "Title",
                type: "text",
                orderIndex: 0,
                options: {
                  defaultValue: null,
                  uniqueCheck: false,
                  unknown: "ignored",
                },
              },
            ],
            views: [
              {
                name: "Source",
                type: "grid",
                isDefault: true,
                order: 0,
                config: {
                  columnWidths: {
                    Title: 240,
                  },
                  sort: [],
                  selectedFields: ["Title"],
                  unknown: "ignored",
                },
                anotherUnknownKey: 123,
              },
            ],
            items: [
              {
                order: 0,
                data: {
                  Title: "Dune",
                },
              },
            ],
            moreUnknownKeys: {
              ok: true,
            },
          },
        ],
        topLevelUnknown: "ignored",
      }),
    );

    expect(archive.type).toBe("full_archive");
    expect(archive.stats.collectionCount).toBe(1);
    expect(archive.collections[0]?.fields[0]?.name).toBe("Title");
  });

  it("rejects unsupported archive versions", () => {
    expect(() =>
      parseFullArchiveContent(
        JSON.stringify({
          type: "full_archive",
          version: 99,
          appVersion: "0.3.0",
          exportedAt: "2026-03-22T14:30:00.000Z",
          description: "",
          stats: {
            collectionCount: 0,
            totalFieldCount: 0,
            totalItemCount: 0,
          },
          collections: [],
        }),
      ),
    ).toThrow(/not supported/i);
  });

  it("rejects invalid archive structures", () => {
    expect(() =>
      parseFullArchiveContent(
        JSON.stringify({
          type: "full_archive",
          version: 1,
          appVersion: "0.3.0",
          exportedAt: "2026-03-22T14:30:00.000Z",
          description: "",
          stats: {
            collectionCount: 1,
            totalFieldCount: 0,
            totalItemCount: 0,
          },
          collections: "nope",
        }),
      ),
    ).toThrow(/invalid archive structure/i);
  });
});

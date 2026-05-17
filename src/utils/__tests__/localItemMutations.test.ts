import { describe, expect, it } from "vitest";
import { applyLocalItemMutation } from "../localItemMutations";
import type { Item } from "../../types/models";

function makeItem(id: number, data: Record<string, string | number | null> = {}): Item {
  return {
    id,
    collection_id: 1,
    order: id,
    data,
  };
}

describe("applyLocalItemMutation", () => {
  it("replaces full item data", () => {
    const result = applyLocalItemMutation(
      {
        items: [makeItem(1, { Title: "Before" })],
        total: 1,
      },
      {
        type: "replace",
        itemId: 1,
        data: { Title: "After" },
      },
    );

    expect(result.items[0]?.data).toEqual({ Title: "After" });
    expect(result.total).toBe(1);
  });

  it("patches matching items and preserves the rest", () => {
    const result = applyLocalItemMutation(
      {
        items: [makeItem(1, { Title: "A", Status: "Todo" }), makeItem(2)],
        total: 2,
      },
      {
        type: "bulkPatch",
        updates: [{ id: 1, patch: { Status: "Done" } }],
      },
    );

    expect(result.items[0]?.data).toEqual({ Title: "A", Status: "Done" });
    expect(result.items[1]?.data).toEqual({});
  });

  it("removes deleted ids and decrements totals", () => {
    const result = applyLocalItemMutation(
      {
        items: [makeItem(1), makeItem(2), makeItem(3)],
        total: 5,
      },
      {
        type: "bulkDelete",
        itemIds: [1, 3],
        affectedCount: 2,
      },
    );

    expect(result.items).toEqual([makeItem(2)]);
    expect(result.total).toBe(3);
  });

  it("patches a single item", () => {
    const result = applyLocalItemMutation(
      {
        items: [makeItem(1, { Title: "A" })],
        total: 1,
      },
      {
        type: "patch",
        itemId: 1,
        patch: { Status: "Done" },
      },
    );
    expect(result.items[0]?.data).toEqual({ Title: "A", Status: "Done" });
  });

  it("handles delete for non-existent items", () => {
    const result = applyLocalItemMutation(
      {
        items: [makeItem(1)],
        total: 1,
      },
      {
        type: "delete",
        itemId: 999,
      },
    );
    expect(result.items).toHaveLength(1);
    expect(result.total).toBe(1);
  });

  it("handles single delete for existent items", () => {
    const result = applyLocalItemMutation(
      {
        items: [makeItem(1)],
        total: 1,
      },
      {
        type: "delete",
        itemId: 1,
      },
    );
    expect(result.items).toHaveLength(0);
    expect(result.total).toBe(0);
  });

  it("handles bulkDelete without affectedCount", () => {
    const result = applyLocalItemMutation(
      {
        items: [makeItem(1), makeItem(2)],
        total: 2,
      },
      {
        type: "bulkDelete",
        itemIds: [1],
      },
    );
    expect(result.total).toBe(1);
  });
});

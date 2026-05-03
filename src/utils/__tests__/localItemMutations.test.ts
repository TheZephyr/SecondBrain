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
});

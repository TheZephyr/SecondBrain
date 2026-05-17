import { describe, expect, it } from "vitest";
import {
  buildDefaultViewConfig,
  mergeViewConfig,
  normalizeKanbanColumnOrder,
  normalizeViewConfig,
  normalizeColumnWidths,
} from "../viewConfig";

describe("viewConfig helpers", () => {
  it("builds a normalized default config", () => {
    expect(buildDefaultViewConfig()).toEqual({
      columnWidths: {},
      sort: [],
      calendarDateField: undefined,
      calendarDateFieldId: undefined,
      groupingFieldId: undefined,
      kanbanColumnOrder: undefined,
      selectedFieldIds: [],
    });
  });

  it("normalizes widths, trims strings, and deduplicates field ids", () => {
    expect(
      normalizeViewConfig({
        columnWidths: { 1: 20, 2: 120.4 },
        sort: [{ field: "data.Title", order: -1 }],
        calendarDateField: "  Due  ",
        selectedFieldIds: [3, 1, 3, -5],
        kanbanColumnOrder: ["  Todo ", "Done", "Todo"],
      }),
    ).toEqual({
      columnWidths: { 1: 60, 2: 120 },
      sort: [{ field: "data.Title", order: -1, emptyPlacement: "last" }],
      calendarDateField: "Due",
      calendarDateFieldId: undefined,
      groupingFieldId: undefined,
      kanbanColumnOrder: ["Todo", "Done"],
      selectedFieldIds: [3, 1],
    });
  });

  it("merges overrides on top of normalized base config", () => {
    expect(
      mergeViewConfig(
        {
          columnWidths: { 1: 120 },
          sort: [],
          selectedFieldIds: [1, 2],
          groupingFieldId: 5,
        },
        {
          groupingFieldId: undefined,
          selectedFieldIds: [2],
        },
      ),
    ).toEqual({
      columnWidths: { 1: 120 },
      sort: [],
      calendarDateField: undefined,
      calendarDateFieldId: undefined,
      groupingFieldId: undefined,
      kanbanColumnOrder: undefined,
      selectedFieldIds: [2],
    });
  });

  it("normalizes kanban order against available options", () => {
    expect(
      normalizeKanbanColumnOrder([" Done ", "Todo", "Done"], [
        "Todo",
        "Doing",
        "Done",
      ]),
    ).toEqual(["Done", "Todo", "Doing"]);
  });

  it("normalizes column widths with allowedFieldIds and invalid inputs", () => {
    const allowed = new Set([1, 2]);
    expect(
      normalizeColumnWidths(
        { 
          1: 100, 
          2: 200, 
          3: 300, // Not allowed
          "invalid": 400, // Invalid ID
          "0": 500, // Invalid ID <= 0
          4: NaN // Invalid width
        }, 
        allowed
      )
    ).toEqual({
      1: 100,
      2: 200
    });
  });

  it("handles non-string entries in kanban column order", () => {
    expect(normalizeKanbanColumnOrder([123, "Todo"] as any, ["Todo"])).toEqual(["Todo"]);
    expect(normalizeKanbanColumnOrder(["Invalid"], ["Todo"])).toEqual(["Todo"]);
  });

  it("normalizes cardTitleFieldId", () => {
    expect(normalizeViewConfig({ cardTitleFieldId: 10 } as any).cardTitleFieldId).toBe(10);
    expect(normalizeViewConfig({ cardTitleFieldId: -5 } as any).cardTitleFieldId).toBeUndefined();
  });
});

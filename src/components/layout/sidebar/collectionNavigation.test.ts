import { describe, expect, it } from "vitest";
import {
  resolveCollectionChevronClick,
  resolveCollectionRowClick,
  type CollectionNavigationContext,
} from "./collectionNavigation";

function makeContext(
  overrides: Partial<CollectionNavigationContext> = {},
): CollectionNavigationContext {
  return {
    currentView: "collection",
    expandedCollectionIds: [1],
    selectedCollectionId: 1,
    targetCollectionId: 1,
    ...overrides,
  };
}

describe("resolveCollectionChevronClick", () => {
  it("selects a different collection when its chevron is opened", () => {
    const result = resolveCollectionChevronClick(
      makeContext({
        targetCollectionId: 2,
      }),
    );

    expect(result).toEqual({
      expandedCollectionIds: [2],
      shouldSelectCollection: true,
    });
  });

  it("collapses the active collection without reselecting it", () => {
    const result = resolveCollectionChevronClick(makeContext());

    expect(result).toEqual({
      expandedCollectionIds: [],
      shouldSelectCollection: false,
    });
  });
});

describe("resolveCollectionRowClick", () => {
  it("does not reselect an already open collection", () => {
    const result = resolveCollectionRowClick(makeContext());

    expect(result).toEqual({
      expandedCollectionIds: [1],
      shouldSelectCollection: false,
    });
  });

  it("reopens a collapsed active collection without reloading it", () => {
    const result = resolveCollectionRowClick(
      makeContext({
        expandedCollectionIds: [],
      }),
    );

    expect(result).toEqual({
      expandedCollectionIds: [1],
      shouldSelectCollection: false,
    });
  });

  it("selects the collection when navigation is outside the collection workspace", () => {
    const result = resolveCollectionRowClick(
      makeContext({
        currentView: "dashboard",
      }),
    );

    expect(result).toEqual({
      expandedCollectionIds: [1],
      shouldSelectCollection: true,
    });
  });
});

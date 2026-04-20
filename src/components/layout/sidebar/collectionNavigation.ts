export type SidebarView = "dashboard" | "collection" | "settings";

export interface CollectionNavigationContext {
  currentView: SidebarView;
  expandedCollectionIds: number[];
  selectedCollectionId: number | null;
  targetCollectionId: number;
}

export interface CollectionNavigationResult {
  expandedCollectionIds: number[];
  shouldSelectCollection: boolean;
}

function shouldSelectCollection(
  context: CollectionNavigationContext,
): boolean {
  return (
    context.selectedCollectionId !== context.targetCollectionId
    || context.currentView !== "collection"
  );
}

export function resolveCollectionChevronClick(
  context: CollectionNavigationContext,
): CollectionNavigationResult {
  if (context.expandedCollectionIds.includes(context.targetCollectionId)) {
    return {
      expandedCollectionIds: [],
      shouldSelectCollection: false,
    };
  }

  return {
    expandedCollectionIds: [context.targetCollectionId],
    shouldSelectCollection: shouldSelectCollection(context),
  };
}

export function resolveCollectionRowClick(
  context: CollectionNavigationContext,
): CollectionNavigationResult {
  return {
    expandedCollectionIds: [context.targetCollectionId],
    shouldSelectCollection: shouldSelectCollection(context),
  };
}

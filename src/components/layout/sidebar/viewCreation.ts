import type { View, ViewType, ViewConfig } from "../../../types/models";
import { buildDefaultViewConfig } from "../../../utils/viewConfig";

type ViewCreationStore = {
  addView: (view: {
    collectionId: number;
    name: string;
    type: ViewType;
    isDefault: 0 | 1;
  }) => Promise<View | null>;
  saveViewConfig: (viewId: number, config: ViewConfig) => Promise<void>;
  loadViews: (
    collectionId: number,
    options?: { preserveActive?: boolean },
  ) => Promise<void>;
};

type CreateConfiguredViewInput = {
  store: ViewCreationStore;
  collectionId: number;
  name: string;
  type: ViewType;
  calendarFieldId?: number | null;
  kanbanFieldId?: number | null;
  selectedFieldIds: number[];
};

export async function createConfiguredView({
  store,
  collectionId,
  name,
  type,
  calendarFieldId,
  kanbanFieldId,
  selectedFieldIds,
}: CreateConfiguredViewInput): Promise<View | null> {
  const created = await store.addView({
    collectionId,
    name,
    type,
    isDefault: 0,
  });

  if (!created) {
    return null;
  }

  await store.saveViewConfig(
    created.id,
    buildDefaultViewConfig({
      calendarDateFieldId: calendarFieldId ?? undefined,
      groupingFieldId: kanbanFieldId ?? undefined,
      selectedFieldIds,
    }),
  );

  await store.loadViews(created.collection_id, { preserveActive: true });

  return created;
}

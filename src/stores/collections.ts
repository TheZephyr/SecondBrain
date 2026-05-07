import { defineStore } from "pinia";
import { ref } from "vue";
import { collectionsRepository } from "../repositories/collectionsRepository";
import { viewsRepository } from "../repositories/viewsRepository";
import type {
  Collection,
  ConvertFieldTypeInput,
  Field,
  FieldConversionPreview,
  FieldConversionResult,
  NewCollectionInput,
  NewFieldInput,
  PreviewFieldConversionInput,
  NewViewInput,
  ReorderFieldsInput,
  ReorderViewsInput,
  UpdateCollectionInput,
  UpdateFieldInput,
  UpdateViewInput,
  View,
  ViewConfig,
} from "../types/models";
import {
  areViewConfigFieldSelectionsEqual,
  buildDefaultViewConfig,
  getOrderedFieldIds,
  mergeViewConfig,
  normalizeViewConfig,
  type NormalizedViewConfig,
} from "../utils/viewConfig";

export const useCollectionsStore = defineStore("collections", () => {
  const collections = ref<Collection[]>([]);
  const collectionItemCounts = ref<Map<number, number>>(new Map());
  const selectedCollection = ref<Collection | null>(null);
  const currentViews = ref<View[]>([]);
  const activeViewId = ref<number | null>(null);
  const fields = ref<Field[]>([]);
  let viewsRequestToken = 0;

  function clearViewsState(): void {
    viewsRequestToken += 1;
    currentViews.value = [];
    activeViewId.value = null;
  }

  function clearFieldsState(): void {
    fields.value = [];
  }

  function setSelectedCollection(collection: Collection | null): void {
    selectedCollection.value = collection;
  }

  function setActiveViewId(id: number | null): void {
    activeViewId.value = id;
  }

  async function loadCollections(): Promise<void> {
    collections.value = await collectionsRepository.getCollections();
  }

  async function loadCollectionItemCounts(): Promise<void> {
    const counts = await collectionsRepository.getCollectionItemCounts();
    const nextStats = new Map<number, number>();
    for (const entry of counts) {
      nextStats.set(entry.collectionId, entry.itemCount);
    }
    collectionItemCounts.value = nextStats;
  }

  async function loadViews(
    collectionId: number,
    options: { preserveActive?: boolean } = {},
  ): Promise<void> {
    const requestToken = ++viewsRequestToken;
    const views = await viewsRepository.getViews(collectionId);

    if (requestToken !== viewsRequestToken) {
      return;
    }

    currentViews.value = views;
    if (options.preserveActive && activeViewId.value !== null) {
      const stillExists = views.some((view) => view.id === activeViewId.value);
      if (stillExists) {
        return;
      }
    }

    const defaultView = views.find((view) => view.is_default === 1);
    activeViewId.value = defaultView?.id ?? views[0]?.id ?? null;
  }

  async function loadFields(collectionId: number): Promise<void> {
    fields.value = await collectionsRepository.getFields(collectionId);
  }

  async function addCollection(
    collection: NewCollectionInput,
  ): Promise<Collection | null> {
    const created = await collectionsRepository.addCollection(collection);
    if (created) {
      await loadCollections();
      await loadCollectionItemCounts();
    }
    return created;
  }

  async function updateCollection(
    collection: UpdateCollectionInput,
  ): Promise<boolean> {
    const success = await collectionsRepository.updateCollection(collection);
    if (success) {
      await loadCollections();
    }
    return success;
  }

  async function deleteCollection(id: number): Promise<boolean> {
    const success = await collectionsRepository.deleteCollection(id);
    if (success) {
      await loadCollections();
      await loadCollectionItemCounts();
      if (selectedCollection.value?.id === id) {
        selectedCollection.value = null;
        clearFieldsState();
        clearViewsState();
      }
    }
    return success;
  }

  async function addView(view: NewViewInput): Promise<View | null> {
    const created = await viewsRepository.addView(view);
    if (created) {
      await loadViews(view.collectionId, { preserveActive: true });
      activeViewId.value = created.id;
    }
    return created;
  }

  async function updateView(view: UpdateViewInput): Promise<boolean> {
    const collection = selectedCollection.value;
    if (!collection) {
      return false;
    }

    const success = await viewsRepository.updateView(view);
    if (success) {
      await loadViews(collection.id, { preserveActive: true });
    }
    return success;
  }

  async function deleteView(id: number): Promise<boolean> {
    const collection = selectedCollection.value;
    if (!collection) {
      return false;
    }

    const previousActiveViewId = activeViewId.value;
    const success = await viewsRepository.deleteView(id);
    if (success) {
      await loadViews(collection.id, { preserveActive: true });
      if (
        previousActiveViewId !== null &&
        !currentViews.value.some((view) => view.id === previousActiveViewId)
      ) {
        activeViewId.value = currentViews.value[0]?.id ?? null;
      }
    }
    return success;
  }

  async function reorderViews(input: ReorderViewsInput): Promise<boolean> {
    const payload: ReorderViewsInput = {
      collectionId: input.collectionId,
      viewOrders: input.viewOrders.map((entry) => ({
        id: entry.id,
        order: entry.order,
      })),
    };

    const success = await viewsRepository.reorderViews(payload);
    if (success) {
      await loadViews(payload.collectionId, { preserveActive: true });
    }
    return success;
  }

  async function loadViewConfig(
    viewId: number,
  ): Promise<NormalizedViewConfig | null> {
    const parsedViewId = Number(viewId);
    if (!Number.isInteger(parsedViewId) || parsedViewId <= 0) {
      return null;
    }

    const config = await viewsRepository.getViewConfig(parsedViewId);
    return config ? normalizeViewConfig(config) : null;
  }

  async function saveViewConfig(
    viewId: number,
    config: ViewConfig,
  ): Promise<void> {
    const parsedViewId = Number(viewId);
    if (!Number.isInteger(parsedViewId) || parsedViewId <= 0) {
      return;
    }

    const normalizedConfig = normalizeViewConfig(config);
    await viewsRepository.updateViewConfig({
      viewId: parsedViewId,
      config: normalizedConfig,
    });
  }

  async function updateChildViewFieldSelections(
    collectionId: number,
    updater: (currentIds: number[], allFieldIds: number[]) => number[],
    removedFieldId?: number,
  ): Promise<void> {
    const childViews = currentViews.value.filter(
      (view) => view.collection_id === collectionId && view.is_default === 0,
    );
    if (childViews.length === 0) {
      return;
    }

    const allFieldIds = getOrderedFieldIds(
      fields.value.filter((field) => field.collection_id === collectionId),
    );

    for (const view of childViews) {
      const existing = await loadViewConfig(view.id);
      const baseConfig = existing ?? buildDefaultViewConfig();
      const baseSelected =
        baseConfig.selectedFieldIds.length > 0
          ? baseConfig.selectedFieldIds
          : allFieldIds;
      const nextSelected = updater(baseSelected, allFieldIds);
      const groupingFieldId =
        removedFieldId && baseConfig.groupingFieldId === removedFieldId
          ? undefined
          : baseConfig.groupingFieldId;
      const cardTitleFieldId =
        removedFieldId && baseConfig.cardTitleFieldId === removedFieldId
          ? undefined
          : baseConfig.cardTitleFieldId;
      const kanbanColumnOrder =
        groupingFieldId === undefined ? undefined : baseConfig.kanbanColumnOrder;

      if (
        areViewConfigFieldSelectionsEqual(nextSelected, baseSelected) &&
        cardTitleFieldId === baseConfig.cardTitleFieldId &&
        groupingFieldId === baseConfig.groupingFieldId &&
        kanbanColumnOrder === baseConfig.kanbanColumnOrder
      ) {
        continue;
      }

      await saveViewConfig(
        view.id,
        mergeViewConfig(baseConfig, {
          cardTitleFieldId,
          groupingFieldId,
          kanbanColumnOrder,
          selectedFieldIds: nextSelected,
        }),
      );
    }
  }

  async function addField(field: NewFieldInput): Promise<Field | null> {
    const created = await collectionsRepository.addField(field);
    if (!created) {
      return null;
    }

    await loadFields(field.collectionId);
    await updateChildViewFieldSelections(field.collectionId, (currentIds) => {
      const next = [...currentIds];
      if (!next.includes(created.id)) {
        next.push(created.id);
      }
      return next;
    });

    return {
      id: created.id,
      collection_id: field.collectionId,
      name: field.name,
      type: field.type,
      description: field.description ?? null,
      options: field.options,
      order_index: field.orderIndex ?? 0,
    };
  }

  async function updateField(field: UpdateFieldInput): Promise<boolean> {
    const collection = selectedCollection.value;
    if (!collection) {
      return false;
    }

    const success = await collectionsRepository.updateField(field);
    if (success) {
      await loadFields(collection.id);
    }
    return success;
  }

  async function previewFieldConversion(
    input: PreviewFieldConversionInput,
  ): Promise<FieldConversionPreview | null> {
    return collectionsRepository.previewFieldConversion({
      fieldId: input.fieldId,
      targetType: input.targetType,
      targetOptions: input.targetOptions,
    });
  }

  async function convertFieldType(
    input: ConvertFieldTypeInput,
  ): Promise<FieldConversionResult | null> {
    const collection = selectedCollection.value;
    if (!collection) {
      return null;
    }

    const result = await collectionsRepository.convertFieldType({
      fieldId: input.fieldId,
      targetType: input.targetType,
      targetOptions: input.targetOptions,
    });
    if (result) {
      await loadFields(collection.id);
    }
    return result;
  }

  async function reorderFields(input: ReorderFieldsInput): Promise<boolean> {
    const payload: ReorderFieldsInput = {
      collectionId: input.collectionId,
      fieldOrders: input.fieldOrders.map((entry) => ({
        id: entry.id,
        orderIndex: entry.orderIndex,
      })),
    };

    const success = await collectionsRepository.reorderFields(payload);
    if (success) {
      await loadFields(payload.collectionId);
    }
    return success;
  }

  async function deleteField(fieldId: number): Promise<boolean> {
    const collection = selectedCollection.value;
    if (!collection) {
      return false;
    }

    const success = await collectionsRepository.deleteField(fieldId);
    if (success) {
      const collectionId = collection.id;
      await loadFields(collectionId);
      await updateChildViewFieldSelections(
        collectionId,
        (currentIds, allFieldIds) => {
          const next = currentIds.filter((id) => id !== fieldId);
          if (next.length === 0 && allFieldIds.length > 0) {
            return allFieldIds;
          }
          return next;
        },
        fieldId,
      );
    }
    return success;
  }

  return {
    collections,
    collectionItemCounts,
    selectedCollection,
    currentViews,
    activeViewId,
    fields,
    clearViewsState,
    clearFieldsState,
    setSelectedCollection,
    setActiveViewId,
    loadCollections,
    loadCollectionItemCounts,
    loadViews,
    loadFields,
    addCollection,
    updateCollection,
    deleteCollection,
    addView,
    updateView,
    deleteView,
    reorderViews,
    loadViewConfig,
    saveViewConfig,
    addField,
    updateField,
    previewFieldConversion,
    convertFieldType,
    reorderFields,
    deleteField,
  };
});

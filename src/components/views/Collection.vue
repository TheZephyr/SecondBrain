<template>
  <div class="flex h-full min-h-0 flex-col">
    <div class="flex min-h-0 flex-1 flex-col">
      <CollectionSettingsPanel
        v-if="collectionSettingsOpen"
        :collection="collection"
        :fields="fields"
        :itemsTotal="itemsTotal"
        @save-settings="saveSettings"
        @delete-collection="confirmDeleteCollection"
      />
      <CollectionFieldsPanel
        v-else-if="activeCollectionPanel === 'fields' && isSourceViewActive"
        :orderedFields="sourceOrderedFields"
        @add-field="addField"
        @delete-field="confirmDeleteField"
        @reorder-fields="onFieldsReorder"
      />
      <CollectionChildFieldsPanel
        v-else-if="activeCollectionPanel === 'fields' && activeView"
        :orderedFields="sourceOrderedFields"
        :selectedFieldIds="selectedFieldIds"
        @toggle-field="onToggleSelectedField"
        @reorder-selected="onReorderSelectedFields"
      />
      <template v-else>
        <CollectionGrid
          v-if="activeView?.type === 'grid'"
          :viewId="activeView.id"
          :items="items"
          :itemsTotal="itemsTotal"
          :itemsLoading="itemsLoading"
          :itemsFullyLoaded="itemsFullyLoaded"
          :orderedFields="viewOrderedFields"
          :searchQuery="searchQuery"
          :debouncedSearchQuery="debouncedSearchQuery"
          :multiSortMeta="multiSortMeta"
          :loadNextPage="loadNextPage"
          @update:searchQuery="searchQuery = $event"
          @update:multiSortMeta="multiSortMeta = $event"
          @sort="onItemsSort"
          @edit-item="openEditItemDialog"
          @delete-item="confirmDeleteItem"
          @update-item="onInlineUpdateItem"
          @insert-item-at="onInsertItemAt"
          @duplicate-item="onDuplicateItem"
          @move-item="onMoveItem"
          @manage-fields="store.setActiveCollectionPanel('fields')"
          @open-add-item="openAddItemDialog"
        />
        <CollectionKanbanView
          v-else-if="activeView?.type === 'kanban'"
          :orderedFields="viewOrderedFields"
        />
        <CollectionCalendarView
          v-else-if="activeView?.type === 'calendar'"
          :viewId="activeView.id"
          :items="items"
          :itemsLoading="itemsLoading"
          :itemsFullyLoaded="itemsFullyLoaded"
          :itemsSearch="itemsSearch"
          :itemsSort="itemsSort"
          :orderedFields="viewOrderedFields"
          :loadItems="loadCollectionItems"
          @edit-item="openEditItemDialog"
        />
      </template>
    </div>

    <CollectionItemEditorDialog
      :visible="showAddItemForm"
      :orderedFields="viewOrderedFields"
      :editingItem="editingItem"
      @update:visible="onItemDialogVisibilityChange"
      @save="saveItem"
    />

    <ConfirmDialog />
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useConfirm } from 'primevue/useconfirm'
import ConfirmDialog from 'primevue/confirmdialog'
import { useStore } from '../../store'
import { useNotificationsStore } from '../../stores/notifications'
import {
  collectionNameSchema,
  fieldNameSchema
} from '../../validation/schemas'
import { useSafeFields } from '../../composables/collection/useSafeFields'
import {
  useCollectionItemsQuery,
  type LoadItemsOptions
} from '../../composables/collection/useCollectionItemsQuery'
import type {
  Collection,
  Field,
  Item,
  InsertItemAtInput,
  DuplicateItemInput,
  MoveItemInput,
  UpdateItemInput,
  ViewConfig
} from '../../types/models'
import CollectionGrid from './collection/grid/CollectionGrid.vue'
import CollectionKanbanView from './collection/CollectionKanbanView.vue'
import CollectionCalendarView from './collection/calendar/CollectionCalendarView.vue'
import CollectionItemEditorDialog from './collection/CollectionItemEditorDialog.vue'
import CollectionFieldsPanel from './collection/CollectionFieldsPanel.vue'
import CollectionChildFieldsPanel from './collection/CollectionChildFieldsPanel.vue'
import CollectionSettingsPanel from './collection/CollectionSettingsPanel.vue'
import type {
  CollectionSettingsSavePayload,
  FieldDraftInput,
  ItemEditorSavePayload
} from './collection/types'

const store = useStore()
const confirm = useConfirm()
const notifications = useNotificationsStore()
const {
  fields,
  items,
  itemsTotal,
  itemsLoading,
  itemsFullyLoaded,
  itemsSearch,
  itemsSort,
  activeCollectionPanel,
  collectionSettingsOpen,
  currentViews,
  activeViewId
} = storeToRefs(store)

const props = defineProps<{
  collection: Collection
}>()

const emit = defineEmits<{
  (e: 'collection-deleted'): void
}>()

const showAddItemForm = ref(false)
const editingItem = ref<Item | null>(null)

const { safeFields, orderedFields: sourceOrderedFields } = useSafeFields({
  fields,
  notifications
})

const collectionId = computed(() => props.collection.id)

const activeView = computed(() => {
  return currentViews.value.find(view => view.id === activeViewId.value) ?? null
})

const isSourceViewActive = computed(() => activeView.value?.is_default === 1)

const childViewConfig = ref<ViewConfig | null>(null)
let childConfigToken = 0

const selectedFieldIds = computed(() => {
  if (!activeView.value || activeView.value.is_default === 1) {
    return []
  }

  const configured = childViewConfig.value?.selectedFieldIds ?? []
  if (configured.length > 0) {
    return configured
  }

  return sourceOrderedFields.value.map(field => field.id)
})

const viewOrderedFields = computed(() => {
  if (!activeView.value || activeView.value.is_default === 1) {
    return sourceOrderedFields.value
  }

  const fieldMap = new Map(sourceOrderedFields.value.map(field => [field.id, field]))
  const ordered = selectedFieldIds.value
    .map(id => fieldMap.get(id))
    .filter((field): field is Field => Boolean(field))

  return ordered
})

async function loadCollectionItems(options: LoadItemsOptions = {}) {
  await store.loadItems(props.collection.id, options)
}

const {
  searchQuery,
  debouncedSearchQuery,
  multiSortMeta,
  onItemsSort,
  loadNextPage
} = useCollectionItemsQuery({
  collectionId,
  viewId: activeViewId,
  activeViewType: computed(() => activeView.value?.type ?? null),
  safeFields,
  items,
  itemsLoading,
  itemsFullyLoaded,
  loadItems: loadCollectionItems,
  loadViewConfig: store.loadViewConfig,
  saveViewConfig: store.saveViewConfig
})

watch(
  [activeViewId, currentViews],
  async () => {
    childViewConfig.value = null

    const view = currentViews.value.find(view => view.id === activeViewId.value) ?? null
    if (!view || view.is_default === 1) {
      return
    }

    const token = ++childConfigToken
    const config = await store.loadViewConfig(view.id)
    if (token !== childConfigToken) {
      return
    }

    childViewConfig.value = config
  },
  { immediate: true }
)

watch(
  () => props.collection.id,
  () => {
    showAddItemForm.value = false
    editingItem.value = null
    store.setCollectionSettingsOpen(false)
  }
)

function openAddItemDialog() {
  editingItem.value = null
  showAddItemForm.value = true
}

function openEditItemDialog(item: Item) {
  editingItem.value = item
  showAddItemForm.value = true
}

function onItemDialogVisibilityChange(nextVisible: boolean) {
  showAddItemForm.value = nextVisible
  if (!nextVisible) {
    editingItem.value = null
  }
}

async function onInlineUpdateItem(payload: UpdateItemInput) {
  await store.updateItem(payload)
}

async function onInsertItemAt(payload: InsertItemAtInput) {
  await store.insertItemAt(payload)
}

async function onDuplicateItem(payload: DuplicateItemInput) {
  await store.duplicateItem(payload)
}

async function onMoveItem(payload: MoveItemInput) {
  await store.moveItem(payload)
}

async function saveItem(payload: ItemEditorSavePayload) {
  if (payload.editingItemId) {
    await store.updateItem({
      id: payload.editingItemId,
      data: payload.data
    })
  } else {
    await store.addItem({
      collectionId: props.collection.id,
      data: payload.data
    })
  }

  showAddItemForm.value = false
  editingItem.value = null
}

async function addField(newField: FieldDraftInput) {
  const nameResult = fieldNameSchema.safeParse(newField.name)
  if (!nameResult.success) {
    notifications.push({
      severity: 'warn',
      summary: 'Invalid field name',
      detail: nameResult.error.issues[0]?.message || 'Please enter a valid field name.',
      life: 5000
    })
    return
  }

  const nextOrderIndex = fields.value.reduce(
    (maxOrder, field) => Math.max(maxOrder, field.order_index),
    -1
  ) + 1

  await store.addField({
    collectionId: props.collection.id,
    name: nameResult.data,
    type: newField.type,
    options: newField.type === 'select' ? newField.options : null,
    orderIndex: nextOrderIndex
  })
}

async function confirmDeleteField(field: Field) {
  confirm.require({
    header: 'Delete Field',
    message: `Delete "${field.name}" field? All data in this field will be lost.`,
    icon: 'pi pi-exclamation-triangle',
    acceptLabel: 'Delete',
    rejectLabel: 'Cancel',
    accept: async () => {
      await store.deleteField(field.id)
    }
  })
}

async function onFieldsReorder(reorderedFields: Field[]) {
  if (!reorderedFields) return

  const visibleFieldIds = sourceOrderedFields.value.map(field => field.id)
  const visibleFieldIdSet = new Set(visibleFieldIds)
  const reorderedFieldIds = reorderedFields.map(field => field.id)
  const reorderedFieldIdSet = new Set(reorderedFieldIds)

  if (
    reorderedFieldIds.length !== visibleFieldIds.length ||
    reorderedFieldIdSet.size !== reorderedFieldIds.length ||
    reorderedFieldIds.some(id => !visibleFieldIdSet.has(id))
  ) {
    notifications.push({
      severity: 'warn',
      summary: 'Unable to reorder fields',
      detail: 'Field list changed while reordering. Reopen the Fields panel and try again.',
      life: 5000
    })
    return
  }

  const allFieldsInOrder = [...fields.value].sort((a, b) => {
    if (a.order_index !== b.order_index) {
      return a.order_index - b.order_index
    }
    return a.id - b.id
  })

  let reorderedIndex = 0
  const completeFieldOrder = allFieldsInOrder.map(field => {
    if (!visibleFieldIdSet.has(field.id)) {
      return field
    }

    const nextField = reorderedFields[reorderedIndex]
    reorderedIndex += 1
    return nextField
  })

  if (reorderedIndex !== reorderedFields.length) {
    notifications.push({
      severity: 'warn',
      summary: 'Unable to reorder fields',
      detail: 'Field reorder payload was incomplete. Reopen the Fields panel and try again.',
      life: 5000
    })
    return
  }

  await store.reorderFields({
    collectionId: props.collection.id,
    fieldOrders: completeFieldOrder.map((field, index) => ({
      id: field.id,
      orderIndex: index
    }))
  })
}

async function persistChildViewConfig(
  viewId: number,
  nextSelectedIds: number[]
) {
  let existing = childViewConfig.value
  if (!existing) {
    existing = await store.loadViewConfig(viewId)
  }
  const config: ViewConfig = {
    columnWidths: existing?.columnWidths ?? {},
    sort: existing?.sort ?? [],
    calendarDateField: existing?.calendarDateField,
    calendarDateFieldId: existing?.calendarDateFieldId,
    selectedFieldIds: nextSelectedIds
  }

  await store.saveViewConfig(viewId, config)
  if (activeView.value?.id === viewId) {
    childViewConfig.value = config
  }
}

async function onToggleSelectedField(payload: { id: number; selected: boolean }) {
  const viewId = activeView.value?.id
  if (!viewId || activeView.value?.is_default === 1) {
    return
  }

  const baseIds = selectedFieldIds.value
  let nextIds = baseIds

  if (payload.selected) {
    if (!baseIds.includes(payload.id)) {
      nextIds = [...baseIds, payload.id]
    }
  } else {
    nextIds = baseIds.filter(id => id !== payload.id)
  }

  if (nextIds === baseIds) {
    return
  }

  if (nextIds.length === 0) {
    nextIds = sourceOrderedFields.value.map(field => field.id)
  }

  await persistChildViewConfig(viewId, nextIds)
}

async function onReorderSelectedFields(payload: { draggedId: number; targetId: number }) {
  const viewId = activeView.value?.id
  if (!viewId || activeView.value?.is_default === 1) {
    return
  }

  const baseIds = selectedFieldIds.value
  if (!baseIds.includes(payload.draggedId) || !baseIds.includes(payload.targetId)) {
    return
  }

  const nextIds = baseIds.filter(id => id !== payload.draggedId)
  const targetIndex = nextIds.indexOf(payload.targetId)
  if (targetIndex < 0) {
    return
  }
  nextIds.splice(targetIndex, 0, payload.draggedId)

  await persistChildViewConfig(viewId, nextIds)
}

async function confirmDeleteItem(item: Item) {
  confirm.require({
    header: 'Delete Item',
    message: 'Are you sure you want to delete this row?',
    icon: 'pi pi-exclamation-triangle',
    acceptLabel: 'Delete',
    rejectLabel: 'Cancel',
    accept: async () => {
      await store.deleteItem(item)
    }
  })
}

async function saveSettings(payload: CollectionSettingsSavePayload) {
  const nameResult = collectionNameSchema.safeParse(payload.name)

  if (!nameResult.success) {
    let detail = 'Please check your collection settings.'
    if (!nameResult.success) {
      detail = nameResult.error.issues[0]?.message || detail
    }

    notifications.push({
      severity: 'warn',
      summary: 'Invalid collection settings',
      detail,
      life: 5000
    })
    return
  }

  await store.updateCollection({
    id: props.collection.id,
    name: nameResult.data
  })

  store.setCollectionSettingsOpen(false)
}

async function confirmDeleteCollection() {
  confirm.require({
    header: 'Delete Collection',
    message: `Delete "${props.collection.name}" and all its data? This cannot be undone.`,
    icon: 'pi pi-exclamation-triangle',
    acceptLabel: 'Delete Collection',
    rejectLabel: 'Cancel',
    accept: async () => {
      await store.deleteCollection(props.collection.id)
      emit('collection-deleted')
    }
  })
}
</script>

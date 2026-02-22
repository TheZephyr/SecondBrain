<template>
  <div class="mx-auto flex h-full min-h-0 max-w-6xl flex-col px-8 py-6">
    <CollectionHeaderBar :collection="collection" :searchQuery="searchQuery" :fieldsOpen="showFieldsManager"
      @update:searchQuery="searchQuery = $event" @open-add-item="openAddItemDialog"
      @toggle-fields="toggleFieldsDrawer" />

    <div class="min-h-0 flex-1">
      <CollectionItemsPanel :items="items" :itemsTotal="itemsTotal" :itemsLoading="itemsLoading" :itemsPage="itemsPage"
        :itemsRows="itemsRows" :orderedFields="orderedFields" :debouncedSearchQuery="debouncedSearchQuery"
        :multiSortMeta="multiSortMeta" @update:multiSortMeta="multiSortMeta = $event" @page="onItemsPage"
        @sort="onItemsSort" @delete-item="confirmDeleteItem" @update-item="onInlineUpdateItem"
        @open-fields-drawer="openFieldsDrawer({ focusAddField: true })" @insert-item-at="onInsertItemAt"
        @duplicate-item="onDuplicateItem" @move-item="onMoveItem" />
    </div>

    <!-- TODO: Legacy add/edit dialog retained for toolbar Add Item until inline add is available. -->
    <CollectionItemEditorDialog :visible="showAddItemForm" :orderedFields="orderedFields" :editingItem="editingItem"
      @update:visible="onItemDialogVisibilityChange" @save="saveItem" />

    <Drawer v-model:visible="showFieldsManager" header="Fields" position="right" :style="{ width: '50%' }" modal
      :pt="drawerPt" @after-show="onFieldsDrawerAfterShow">
      <div class="p-4">
        <CollectionFieldsDialog ref="fieldsDialogRef" :visible="showFieldsManager" :orderedFields="orderedFields"
          @update:visible="showFieldsManager = $event" @add-field="addField" @delete-field="confirmDeleteField"
          @reorder-fields="onFieldsReorder" />
      </div>
    </Drawer>

    <CollectionSettingsDialog :visible="showCollectionSettings" :collection="collection" :fields="fields"
      :itemsTotal="itemsTotal" @update:visible="showCollectionSettings = $event" @save-settings="saveSettings"
      @delete-collection="confirmDeleteCollection" />

    <ConfirmDialog />
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useConfirm } from 'primevue/useconfirm'
import ConfirmDialog from 'primevue/confirmdialog'
import Drawer from 'primevue/drawer'
import { useStore } from '../../store'
import { useNotificationsStore } from '../../stores/notifications'
import {
  collectionNameSchema,
  fieldNameSchema,
  iconSchema
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
  UpdateItemInput
} from '../../types/models'
import CollectionHeaderBar from './collection/CollectionHeaderBar.vue'
import CollectionItemsPanel from './collection/CollectionItemsPanel.vue'
import CollectionItemEditorDialog from './collection/CollectionItemEditorDialog.vue'
import CollectionFieldsDialog from './collection/CollectionFieldsDialog.vue'
import CollectionSettingsDialog from './collection/CollectionSettingsDialog.vue'
import type {
  CollectionSettingsSavePayload,
  FieldDraftInput,
  ItemEditorSavePayload
} from './collection/types'

const store = useStore()
const confirm = useConfirm()
const notifications = useNotificationsStore()
const { fields, items, itemsTotal, itemsLoading, itemsPage, itemsRows } = storeToRefs(store)

const props = defineProps<{
  collection: Collection
}>()

const emit = defineEmits<{
  (e: 'collection-deleted'): void
}>()

const showAddItemForm = ref(false)
const showFieldsManager = ref(false)
const showCollectionSettings = ref(false)
const editingItem = ref<Item | null>(null)
const fieldsDialogRef = ref<InstanceType<typeof CollectionFieldsDialog> | null>(null)
const pendingFocusAddField = ref(false)

const drawerPt = {
  pcCloseButton: {
    root: {
      class:
        'hover:bg-[var(--bg-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)]'
    }
  }
}

const { safeFields, orderedFields } = useSafeFields({
  fields,
  notifications
})

const collectionId = computed(() => props.collection.id)

async function loadCollectionItems(options: LoadItemsOptions = {}) {
  await store.loadItems(props.collection.id, options)
}

const {
  searchQuery,
  debouncedSearchQuery,
  multiSortMeta,
  onItemsPage,
  onItemsSort
} = useCollectionItemsQuery({
  collectionId,
  safeFields,
  loadItems: loadCollectionItems
})

watch(
  () => props.collection.id,
  () => {
    showAddItemForm.value = false
    showFieldsManager.value = false
    showCollectionSettings.value = false
    editingItem.value = null
    pendingFocusAddField.value = false
  }
)

watch(showFieldsManager, (isVisible) => {
  if (!isVisible) {
    pendingFocusAddField.value = false
  }
})

function openAddItemDialog() {
  editingItem.value = null
  showAddItemForm.value = true
}

function focusAddFieldInDrawer() {
  fieldsDialogRef.value?.focusAddField?.()
}

function openFieldsDrawer(options: { focusAddField?: boolean } = {}) {
  const { focusAddField = false } = options

  if (showFieldsManager.value) {
    if (focusAddField) {
      focusAddFieldInDrawer()
    }
    return
  }

  showFieldsManager.value = true
  if (focusAddField) {
    pendingFocusAddField.value = true
  }
}

function toggleFieldsDrawer() {
  if (showFieldsManager.value) {
    showFieldsManager.value = false
    pendingFocusAddField.value = false
    return
  }

  openFieldsDrawer()
}

function onFieldsDrawerAfterShow() {
  if (!pendingFocusAddField.value) return
  pendingFocusAddField.value = false
  focusAddFieldInDrawer()
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

  const visibleFieldIds = orderedFields.value.map(field => field.id)
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
  const iconResult = iconSchema.safeParse(payload.icon)

  if (!nameResult.success || !iconResult.success) {
    let detail = 'Please check your collection settings.'
    if (!nameResult.success) {
      detail = nameResult.error.issues[0]?.message || detail
    } else if (!iconResult.success) {
      detail = iconResult.error.issues[0]?.message || detail
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
    name: nameResult.data,
    icon: iconResult.data
  })

  showCollectionSettings.value = false
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

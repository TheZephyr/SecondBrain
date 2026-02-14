<template>
  <div class="mx-auto max-w-6xl px-10 py-8">
    <CollectionHeaderBar :collection="collection" @open-fields="showFieldsManager = true" @open-add-item="openAddItemDialog"
      @open-settings="showCollectionSettings = true" />

    <CollectionItemsPanel :items="items" :itemsTotal="itemsTotal" :itemsLoading="itemsLoading" :itemsPage="itemsPage"
      :itemsRows="itemsRows" :orderedFields="orderedFields" :searchQuery="searchQuery" :debouncedSearchQuery="debouncedSearchQuery"
      :multiSortMeta="multiSortMeta" @update:searchQuery="searchQuery = $event" @update:multiSortMeta="multiSortMeta = $event"
      @page="onItemsPage" @sort="onItemsSort" @manage-fields="showFieldsManager = true" @edit-item="openEditItemDialog"
      @delete-item="confirmDeleteItem" />

    <CollectionItemEditorDialog :visible="showAddItemForm" :orderedFields="orderedFields" :editingItem="editingItem"
      @update:visible="onItemDialogVisibilityChange" @save="saveItem" />

    <CollectionFieldsDialog :visible="showFieldsManager" :orderedFields="orderedFields"
      @update:visible="showFieldsManager = $event" @add-field="addField" @delete-field="confirmDeleteField"
      @reorder-fields="onFieldsReorder" />

    <CollectionSettingsDialog :visible="showCollectionSettings" :collection="collection" :fields="fields" :itemsTotal="itemsTotal"
      @update:visible="showCollectionSettings = $event" @save-settings="saveSettings" @delete-collection="confirmDeleteCollection" />

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
  Item
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

  await store.reorderFields({
    collectionId: props.collection.id,
    fieldOrders: reorderedFields.map((field, index) => ({
      id: field.id,
      orderIndex: index
    }))
  })
}

async function confirmDeleteItem(item: Item) {
  confirm.require({
    header: 'Delete Item',
    message: 'Are you sure you want to delete this item? This action cannot be undone.',
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

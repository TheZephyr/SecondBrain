<template>
  <div class="flex h-full min-h-0 flex-col">
    <CollectionCalendarToolbar
      :monthLabel="monthLabel"
      :dateFields="dateFields"
      :selectedDateFieldName="selectedDateFieldName"
      :isLoadingAll="isEnsuringAllItems"
      @previous-month="goToPreviousMonth"
      @next-month="goToNextMonth"
      @update:selectedDateFieldName="value => void setSelectedDateFieldName(value)"
    />

    <div
      v-if="dateFields.length === 0"
      class="flex flex-1 flex-col items-center justify-center px-8 text-center"
    >
      <i class="pi pi-calendar mb-4 text-4xl text-[var(--text-muted)]"></i>
      <h3 class="text-lg font-semibold text-[var(--text-primary)]">No Date Fields</h3>
      <p class="mt-2 max-w-md text-sm text-[var(--text-muted)]">
        Calendar view requires at least one date field in this collection.
      </p>
    </div>

    <div
      v-else-if="dateFields.length > 1 && !selectedDateFieldName"
      class="flex flex-1 flex-col items-center justify-center px-8 text-center"
    >
      <i class="pi pi-calendar-clock mb-4 text-4xl text-[var(--text-muted)]"></i>
      <h3 class="text-lg font-semibold text-[var(--text-primary)]">Choose a Date Field</h3>
      <p class="mt-2 max-w-md text-sm text-[var(--text-muted)]">
        Select the date field that should place items on the calendar.
      </p>
    </div>

    <CollectionCalendarGrid
      v-else
      class="min-h-0 flex-1"
      :weekdayLabels="weekdayLabels"
      :cells="monthCells"
      @edit-item="emit('edit-item', $event)"
    />
  </div>
</template>

<script setup lang="ts">
import { toRef } from 'vue'
import { useStore } from '../../../../store'
import type { Field, Item, ItemSortSpec } from '../../../../types/models'
import { useCollectionCalendar } from '../../../../composables/collection/calendar/useCollectionCalendar'
import type { LoadItemsOptions } from '../../../../composables/collection/useCollectionItemsQuery'
import CollectionCalendarGrid from './CollectionCalendarGrid.vue'
import CollectionCalendarToolbar from './CollectionCalendarToolbar.vue'

const store = useStore()

const props = defineProps<{
  viewId: number
  items: Item[]
  itemsLoading: boolean
  itemsFullyLoaded: boolean
  itemsSearch: string
  itemsSort: ItemSortSpec[]
  orderedFields: Field[]
  loadItems: (options?: LoadItemsOptions) => Promise<void>
}>()

const emit = defineEmits<{
  'edit-item': [value: Item]
}>()

const {
  dateFields,
  weekdayLabels,
  selectedDateFieldName,
  monthLabel,
  monthCells,
  isEnsuringAllItems,
  setSelectedDateFieldName,
  goToPreviousMonth,
  goToNextMonth
} = useCollectionCalendar({
  viewId: toRef(props, 'viewId'),
  orderedFields: toRef(props, 'orderedFields'),
  items: toRef(props, 'items'),
  itemsLoading: toRef(props, 'itemsLoading'),
  itemsFullyLoaded: toRef(props, 'itemsFullyLoaded'),
  itemsSearch: toRef(props, 'itemsSearch'),
  itemsSort: toRef(props, 'itemsSort'),
  loadItems: props.loadItems,
  loadViewConfig: store.loadViewConfig,
  saveViewConfig: store.saveViewConfig
})
</script>

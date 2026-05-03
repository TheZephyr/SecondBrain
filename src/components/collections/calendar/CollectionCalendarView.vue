<template>
  <div class="flex h-full min-h-0 flex-col">
    <CollectionCalendarToolbar
      :monthLabel="monthLabel"
      :isLoadingAll="isEnsuringAllItems"
      @previous-month="goToPreviousMonth"
      @next-month="goToNextMonth"
    />

    <div
      v-if="dateFields.length === 0"
      class="flex flex-1 flex-col items-center justify-center px-8 text-center"
    >
      <i class="pi pi-calendar mb-4 text-4xl text-(--text-muted)"></i>
      <h3 class="text-lg font-semibold text-(--text-primary)">
        No Date Fields
      </h3>
      <p class="mt-2 max-w-md text-base text-(--text-muted)">
        Calendar view requires at least one date field in this collection.
      </p>
    </div>

    <div
      v-else-if="dateFields.length > 1 && !selectedDateFieldId"
      class="flex flex-1 flex-col items-center justify-center px-8 text-center"
    >
      <i class="pi pi-calendar-clock mb-4 text-4xl text-(--text-muted)"></i>
      <h3 class="text-lg font-semibold text-(--text-primary)">
        Choose a Date Field
      </h3>
      <p class="mt-2 max-w-md text-base text-(--text-muted)">
        Select the date field that should place items on the calendar.
      </p>
    </div>

    <div v-else class="flex min-h-0 flex-1 overflow-hidden">
      <CollectionCalendarGrid
        class="min-h-0 flex-1"
        :weekdayLabels="weekdayLabels"
        :cells="monthCells"
        @edit-item="emit('edit-item', $event)"
      />
      <CollectionCalendarSidebar
        :displayedMonth="displayedMonth"
        :items="sidebarItems"
        :viewOrderedFields="orderedFields"
        :cardTitleField="cardTitleField"
        :numberFieldRanges="numberFieldRanges"
        @set-month="setMonth"
        @set-year="setYear"
        @edit-item="emit('edit-item', $event)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, toRef, watch } from "vue";
import type { Field, Item, ItemSortSpec, NumberFieldRange } from "../../../types/models";
import { useCollectionCalendar } from "../../../composables/collection/calendar/useCollectionCalendar";
import type { LoadItemsOptions } from "../../../composables/collection/useCollectionItemsQuery";
import { itemsRepository } from "../../../repositories/itemsRepository";
import { parseFieldOptions } from "../../../utils/fieldOptions";
import CollectionCalendarGrid from "./CollectionCalendarGrid.vue";
import CollectionCalendarToolbar from "./CollectionCalendarToolbar.vue";
import CollectionCalendarSidebar from "./CollectionCalendarSidebar.vue";

const props = defineProps<{
  collectionId: number;
  viewId: number;
  items: Item[];
  itemsLoading: boolean;
  itemsFullyLoaded: boolean;
  itemsSearch: string;
  itemsSort: ItemSortSpec[];
  orderedFields: Field[];
  cardTitleField: Field | null;
  loadItems: (options?: LoadItemsOptions) => Promise<void>;
  groupingFieldId: number | null;
}>();

const emit = defineEmits<{
  "edit-item": [value: Item];
}>();

const numberFieldRanges = ref<Record<number, NumberFieldRange>>({});

const {
  dateFields,
  weekdayLabels,
  selectedDateFieldId,
  monthLabel,
  displayedMonth,
  monthCells,
  sidebarItems,
  isEnsuringAllItems,
  goToPreviousMonth,
  goToNextMonth,
  setMonth,
  setYear,
} = useCollectionCalendar({
  viewId: toRef(props, "viewId"),
  orderedFields: toRef(props, "orderedFields"),
  items: toRef(props, "items"),
  itemsLoading: toRef(props, "itemsLoading"),
  itemsFullyLoaded: toRef(props, "itemsFullyLoaded"),
  itemsSearch: toRef(props, "itemsSearch"),
  itemsSort: toRef(props, "itemsSort"),
  loadItems: props.loadItems,
  groupingFieldId: toRef(props, "groupingFieldId"),
  cardTitleField: toRef(props, "cardTitleField"),
});

async function loadNumberFieldRanges() {
  const numberFields = props.orderedFields.filter((field) => {
    if (field.type !== "number") {
      return false;
    }

    const options = parseFieldOptions(field.type, field.options) as {
      colorScale?: unknown;
    };
    return Boolean(options.colorScale);
  });

  if (numberFields.length === 0) {
    numberFieldRanges.value = {};
    return;
  }

  const entries = await Promise.all(
    numberFields.map(async (field) => {
      const range = await itemsRepository.getNumberFieldRange({
        collectionId: props.collectionId,
        fieldName: field.name,
      });
      return [field.id, range] as const;
    }),
  );

  numberFieldRanges.value = Object.fromEntries(entries);
}

watch(
  () => [props.collectionId, props.orderedFields] as const,
  () => {
    void loadNumberFieldRanges();
  },
  { immediate: true, deep: true },
);
</script>

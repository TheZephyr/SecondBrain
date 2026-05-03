<template>
  <div class="flex h-full w-64 shrink-0 flex-col border-l border-(--border-color) bg-(--bg-secondary)">
    <!-- Quick Date Switcher -->
    <div class="border-b border-(--border-color) p-4">
      <div class="mb-4 flex items-center justify-between">
        <AppButton text class="h-8 w-8" @click="emit('set-year', currentYear - 1)">
          <template #icon>
            <ChevronLeft class="size-4" />
          </template>
        </AppButton>
        <span class="text-lg font-bold text-(--text-primary)">{{ currentYear }}</span>
        <AppButton text class="h-8 w-8" @click="emit('set-year', currentYear + 1)">
          <template #icon>
            <ChevronRight class="size-4" />
          </template>
        </AppButton>
      </div>

      <div class="grid grid-cols-4 gap-1">
        <button
          v-for="(monthName, index) in monthShortNames"
          :key="monthName"
          class="rounded-md py-1.5 text-xs font-medium transition-colors hover:bg-(--bg-hover)"
          :class="[
            currentMonth === index
              ? 'bg-(--accent-primary) text-white hover:bg-(--accent-primary)'
              : 'text-(--text-secondary)',
          ]"
          @click="emit('set-month', index)"
        >
          {{ monthName }}
        </button>
      </div>
    </div>

    <!-- Items in this month -->
    <div class="flex min-h-0 flex-1 flex-col">
      <div class="flex items-center justify-between border-b border-(--border-color) bg-(--bg-tertiary) px-4 py-2">
        <span class="text-xs font-bold uppercase tracking-wider text-(--text-muted)">
          Items in this month
        </span>
        <span class="rounded-full bg-(--bg-secondary) px-2 py-0.5 text-[10px] font-bold text-(--text-secondary)">
          {{ items.length }}
        </span>
      </div>

      <div class="min-h-0 flex-1 overflow-y-auto p-3">
        <div v-if="items.length > 0" class="space-y-3">
          <CollectionKanbanCard
            v-for="item in items"
            :key="item.id"
            :item="item"
            :viewOrderedFields="viewOrderedFields"
            :cardTitleField="cardTitleField"
            :numberFieldRanges="numberFieldRanges"
            @edit="emit('edit-item', $event)"
          />
        </div>
        <div v-else class="flex h-32 flex-col items-center justify-center text-center opacity-50">
          <i class="pi pi-inbox mb-2 text-2xl"></i>
          <p class="text-xs">No items this month</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { ChevronLeft, ChevronRight } from "lucide-vue-next";
import type { Field, Item, NumberFieldRange } from "../../../types/models";
import AppButton from "@/components/app/ui/AppButton.vue";
import CollectionKanbanCard from "../kanban/CollectionKanbanCard.vue";

const props = defineProps<{
  displayedMonth: Date;
  items: Item[];
  viewOrderedFields: Field[];
  cardTitleField: Field | null;
  numberFieldRanges: Record<number, NumberFieldRange>;
}>();

const emit = defineEmits<{
  (e: "set-month", month: number): void;
  (e: "set-year", year: number): void;
  (e: "edit-item", item: Item): void;
}>();

const currentYear = computed(() => props.displayedMonth.getFullYear());
const currentMonth = computed(() => props.displayedMonth.getMonth());

const monthShortNames = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
];
</script>

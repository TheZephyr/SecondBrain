<template>
  <div
    class="flex h-10 items-center border-b border-(--border-color) bg-(--bg-secondary) px-2 py-5"
  >
    <div class="flex items-center gap-1">
      <!-- <AppButton
        text
        class="h-7 gap-1.5 rounded-md px-2 text-base text-(--text-muted) hover:bg-(--bg-hover) hover:text-(--text-primary)"
      >
        <template #icon>
          <Filter class="size-4" />
        </template>
        <span>Filter</span>
      </AppButton> -->
      <Popover v-model:open="sortPopoverOpen">
        <PopoverTrigger as-child>
          <AppButton
            text
            class="h-7 gap-1.5 rounded-md px-2 text-base"
            :class="sortButtonClass"
          >
            <template #icon>
              <ArrowUpDown class="size-4" />
            </template>
            <span>Sort</span>
            <span
              v-if="multiSortMeta.length > 0"
              class="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-current px-1 text-[10px] font-semibold"
            >
              <span class="text-(--bg-secondary)">{{ multiSortMeta.length }}</span>
            </span>
          </AppButton>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          class="w-[560px] max-w-[calc(100vw-2rem)] p-2"
          @click.stop
        >
          <div
            v-if="multiSortMeta.length === 0"
            class="px-2 py-3 text-base text-(--text-muted)"
          >
            No sort options active.
          </div>
          <div v-else class="space-y-1">
            <div
              v-for="entry in multiSortMeta"
              :key="entry.field"
              class="grid grid-cols-[24px_minmax(0,1fr)_112px_124px_28px] items-center gap-1 rounded-md px-1 py-1 hover:bg-(--bg-hover)"
              :class="draggedField === entry.field ? 'opacity-50' : ''"
              @dragover.prevent="onDragOver(entry.field)"
              @drop.prevent="onDrop(entry.field)"
            >
              <button
                type="button"
                class="flex h-7 w-6 cursor-grab items-center justify-center rounded text-(--text-muted) hover:text-(--text-primary)"
                title="Drag to reorder"
                draggable="true"
                @dragstart="(event) => onDragStart(entry.field, event)"
                @dragend="onDragEnd"
              >
                <GripVertical class="size-4" />
              </button>

              <Select
                :model-value="entry.field"
                @update:model-value="(value) => updateSortField(entry.field, value)"
              >
                <SelectTrigger class="h-7 w-full bg-(--bg-primary) text-base">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem
                    v-for="field in availableFieldsFor(entry.field)"
                    :key="field.id"
                    :value="getFieldKey(field)"
                  >
                    {{ field.name }}
                  </SelectItem>
                </SelectContent>
              </Select>

              <Select
                :model-value="String(entry.order)"
                @update:model-value="(value) => updateSortOrder(entry.field, value)"
              >
                <SelectTrigger class="h-7 w-full bg-(--bg-primary) text-base">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">A -&gt; Z</SelectItem>
                  <SelectItem value="-1">Z -&gt; A</SelectItem>
                </SelectContent>
              </Select>

              <Select
                :model-value="entry.emptyPlacement ?? 'last'"
                @update:model-value="(value) => updateEmptyPlacement(entry.field, value)"
              >
                <SelectTrigger class="h-7 w-full bg-(--bg-primary) text-base">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="last">Empty last</SelectItem>
                  <SelectItem value="first">Empty first</SelectItem>
                </SelectContent>
              </Select>

              <Button
                type="button"
                class="h-7 w-7 rounded-md p-0 text-(--text-muted) hover:bg-(--bg-hover) hover:text-(--danger)"
                title="Remove sort"
                @click="removeSort(entry.field)"
              >
                <Trash2 class="size-4" />
              </Button>
            </div>
          </div>

          <div class="mt-2 border-t border-(--border-color) pt-2">
            <Popover v-model:open="fieldPickerOpen">
              <PopoverTrigger as-child>
                <Button
                  type="button"
                  class="h-8 w-full justify-start rounded-md bg-transparent px-2 text-base text-(--accent-primary) hover:bg-(--bg-hover)"
                  :disabled="unusedFields.length === 0"
                >
                  <Plus class="mr-2 size-4" />
                  Add sort option
                </Button>
              </PopoverTrigger>
              <PopoverContent
                align="start"
                side="right"
                class="w-64 p-1"
                @click.stop
              >
                <button
                  v-for="field in unusedFields"
                  :key="field.id"
                  type="button"
                  class="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-base text-(--text-secondary) hover:bg-(--bg-hover) hover:text-(--text-primary)"
                  @click="addSort(field)"
                >
                  <component
                    :is="iconMap[FIELD_TYPE_META[field.type].icon]"
                    class="size-4 text-(--text-muted)"
                  />
                  <span class="truncate">{{ field.name }}</span>
                </button>
                <div
                  v-if="unusedFields.length === 0"
                  class="px-2 py-2 text-base text-(--text-muted)"
                >
                  All fields are already sorted.
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </PopoverContent>
      </Popover>
    </div>

    <div class="flex-1" />

    <div class="relative">
      <Search
        :size="16"
        class="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-(--text-muted)"
      />
      <AppInput
        v-model="searchModel"
        class="h-7 w-40 pl-8 pr-8 text-base md:w-52"
        type="text"
        placeholder="Search..."
      />
      <Button
        v-if="searchModel"
        type="button"
        class="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-(--text-muted) hover:bg-(--bg-hover) hover:text-(--text-primary) focus:outline-hidden"
        @click="searchModel = ''"
      >
        <X :size="14" />
      </Button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, type Component } from "vue";
import * as icons from "lucide-vue-next";
import {
  ArrowUpDown,
  GripVertical,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-vue-next";
import AppButton from "@/components/app/ui/AppButton.vue";
import AppInput from "@/components/app/ui/AppInput.vue";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FIELD_TYPE_META, type Field } from "@/types/models";
import type { MultiSortMeta } from "../types";

const props = defineProps<{
  multiSortMeta: MultiSortMeta[];
  orderedFields: Field[];
  searchQuery: string;
}>();

const emit = defineEmits<{
  (e: "update:searchQuery", value: string): void;
  (e: "sort", value: MultiSortMeta[]): void;
}>();

const sortPopoverOpen = ref(false);
const fieldPickerOpen = ref(false);
const draggedField = ref<string | null>(null);
const iconMap = icons as unknown as Record<string, Component>;

const searchModel = computed({
  get: () => props.searchQuery,
  set: (value: string) => emit("update:searchQuery", value),
});

const sortButtonClass = computed(() => {
  if (props.multiSortMeta.length > 0) {
    return "bg-(--accent-light) text-(--accent-primary)";
  }

  return "text-(--text-muted) hover:bg-(--bg-hover) hover:text-(--text-primary)";
});

const sortedFieldKeys = computed(
  () => new Set(props.multiSortMeta.map((entry) => entry.field)),
);

const unusedFields = computed(() =>
  props.orderedFields.filter((field) => !sortedFieldKeys.value.has(getFieldKey(field))),
);

function getFieldKey(field: Field): string {
  return `data.${field.name}`;
}

function emitSort(nextMeta: MultiSortMeta[]): void {
  emit(
    "sort",
    nextMeta.map((entry) => ({
      field: entry.field,
      order: entry.order,
      emptyPlacement: entry.emptyPlacement ?? "last",
    })),
  );
}

function availableFieldsFor(currentField: string): Field[] {
  return props.orderedFields.filter((field) => {
    const key = getFieldKey(field);
    return key === currentField || !sortedFieldKeys.value.has(key);
  });
}

function updateSortField(currentField: string, nextValue: unknown): void {
  if (typeof nextValue !== "string" || nextValue === currentField) {
    return;
  }
  if (props.multiSortMeta.some((entry) => entry.field === nextValue)) {
    return;
  }
  emitSort(
    props.multiSortMeta.map((entry) =>
      entry.field === currentField ? { ...entry, field: nextValue } : entry,
    ),
  );
}

function updateSortOrder(field: string, nextValue: unknown): void {
  const order = nextValue === "-1" ? -1 : 1;
  emitSort(
    props.multiSortMeta.map((entry) =>
      entry.field === field ? { ...entry, order } : entry,
    ),
  );
}

function updateEmptyPlacement(field: string, nextValue: unknown): void {
  const emptyPlacement = nextValue === "first" ? "first" : "last";
  emitSort(
    props.multiSortMeta.map((entry) =>
      entry.field === field ? { ...entry, emptyPlacement } : entry,
    ),
  );
}

function removeSort(field: string): void {
  emitSort(props.multiSortMeta.filter((entry) => entry.field !== field));
}

function addSort(field: Field): void {
  emitSort([
    ...props.multiSortMeta,
    { field: getFieldKey(field), order: 1, emptyPlacement: "last" },
  ]);
  fieldPickerOpen.value = false;
}

function onDragStart(field: string, event: DragEvent): void {
  draggedField.value = field;
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", field);
  }
}

function onDragOver(field: string): void {
  if (!draggedField.value || draggedField.value === field) {
    return;
  }
}

function onDrop(targetField: string): void {
  if (!draggedField.value || draggedField.value === targetField) {
    onDragEnd();
    return;
  }

  const next = [...props.multiSortMeta];
  const draggedIndex = next.findIndex((entry) => entry.field === draggedField.value);
  const targetIndex = next.findIndex((entry) => entry.field === targetField);
  if (draggedIndex < 0 || targetIndex < 0) {
    onDragEnd();
    return;
  }

  const [moved] = next.splice(draggedIndex, 1);
  if (!moved) {
    onDragEnd();
    return;
  }
  next.splice(targetIndex, 0, moved);
  emitSort(next);
  onDragEnd();
}

function onDragEnd(): void {
  draggedField.value = null;
}
</script>

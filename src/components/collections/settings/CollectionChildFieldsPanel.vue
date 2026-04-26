<template>
  <div class="flex h-full min-h-0 flex-col px-4 py-4">
    <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
      <AppInput
        v-model="searchQuery"
        type="text"
        placeholder="Search fields"
        class="w-full md:max-w-sm"
      />
      <div class="flex items-center gap-2">
        <AppButton
          severity="secondary"
          text
          :disabled="!isDirty"
          @click="resetDrafts"
          >Reset</AppButton
        >
        <AppButton :disabled="!isDirty" @click="saveDrafts"
          >Save changes</AppButton
        >
      </div>
    </div>

    <div
      class="grid min-h-0 flex-1 gap-4 lg:grid-cols-[minmax(320px,0.9fr)_minmax(0,1.1fr)]"
    >
      <div
        class="min-h-0 overflow-hidden rounded-xl border border-(--border-color) bg-(--bg-primary)"
      >
        <div class="max-h-full overflow-y-auto">
          <div
            v-for="field in filteredFields"
            :key="field.id"
            class="flex items-center gap-3 border-b border-(--border-color) px-4 py-3 last:border-b-0"
          >
            <AppCheckbox
              :binary="true"
              :modelValue="selectedSet.has(field.id)"
              @update:modelValue="
                (value) => toggleField(field.id, Boolean(value))
              "
            />
            <span
              class="flex size-7 items-center justify-center text-(--text-muted)"
              :class="
                selectedSet.has(field.id) && !searchQuery.trim()
                  ? 'cursor-grab'
                  : 'opacity-40'
              "
              :draggable="selectedSet.has(field.id) && !searchQuery.trim()"
              @dragstart="(event) => onDragStart(field.id, event)"
              @dragend="onDragEnd"
              @dragover.prevent="onDragOver(field.id)"
              @drop.prevent="onDrop(field.id)"
            >
              <GripVertical :size="14" />
            </span>
            <component
              :is="iconMap[FIELD_TYPE_META[field.type].icon]"
              :size="14"
              class="text-(--text-muted)"
            />
            <div class="min-w-0 flex-1">
              <div class="truncate font-medium text-(--text-primary)">
                {{ field.name }}
              </div>
              <div class="truncate text-sm text-(--text-muted)">
                {{ FIELD_TYPE_META[field.type].displayName }}
              </div>
            </div>
          </div>
          <div
            v-if="filteredFields.length === 0"
            class="px-4 py-10 text-center text-(--text-muted)"
          >
            No fields match your search.
          </div>
        </div>
      </div>

      <div
        class="min-h-0 overflow-y-auto rounded-xl border border-(--border-color) bg-(--bg-primary) p-4"
      >
        <div v-if="showGroupingSection" class="space-y-3">
          <div class="text-base font-semibold uppercase text-(--text-muted)">
            {{ groupingLabel }}
          </div>
          <AppSelect
            :modelValue="draftGroupingFieldId"
            :options="groupingOptions"
            optionLabel="label"
            optionValue="value"
            placeholder="Choose field"
            class="w-full"
            @update:modelValue="
              (value) =>
                (draftGroupingFieldId = normalizeGroupingFieldId(value))
            "
          />
        </div>
        <div v-else class="text-(--text-muted)">
          Visible fields are configured from the list on the left.
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch, type Component } from "vue";
import * as icons from "lucide-vue-next";
import { GripVertical } from "lucide-vue-next";
import AppCheckbox from "@/components/app/ui/AppCheckbox.vue";
import AppButton from "@/components/app/ui/AppButton.vue";
import AppInput from "@/components/app/ui/AppInput.vue";
import AppSelect from "@/components/app/ui/AppSelect.vue";
import {
  FIELD_TYPE_META,
  type Field,
  type ViewType,
} from "../../../types/models";

const props = defineProps<{
  orderedFields: Field[];
  selectedFieldIds: number[];
  viewType: ViewType;
  groupingFieldId: number | null;
  groupingFields: Field[];
}>();

const emit = defineEmits<{
  (
    e: "save-view-fields",
    value: { selectedFieldIds: number[]; groupingFieldId: number | null },
  ): void;
}>();

const iconMap = icons as unknown as Record<string, Component>;
const searchQuery = ref("");
const draftSelectedFieldIds = ref<number[]>([]);
const draftGroupingFieldId = ref<number | null>(null);
const draggedId = ref<number | null>(null);
const baselineSignature = ref("");

const selectedSet = computed(() => new Set(draftSelectedFieldIds.value));
const groupingLabel = computed(() =>
  props.viewType === "kanban" ? "Stacked by" : "Organised by",
);
const showGroupingSection = computed(
  () => props.viewType === "kanban" || props.viewType === "calendar",
);
const groupingOptions = computed(() =>
  props.groupingFields.map((field) => ({
    label: field.name,
    value: field.id,
  })),
);

const filteredFields = computed(() => {
  const query = searchQuery.value.trim().toLowerCase();
  if (!query) {
    return props.orderedFields;
  }

  return props.orderedFields.filter((field) =>
    field.name.toLowerCase().includes(query),
  );
});

const isDirty = computed(() => currentSignature() !== baselineSignature.value);

function normalizeGroupingFieldId(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function currentSignature() {
  return JSON.stringify({
    selectedFieldIds: draftSelectedFieldIds.value,
    groupingFieldId: draftGroupingFieldId.value,
  });
}

function resetDrafts() {
  draftSelectedFieldIds.value = [...props.selectedFieldIds];
  draftGroupingFieldId.value = props.groupingFieldId;
  baselineSignature.value = currentSignature();
}

function toggleField(id: number, selected: boolean) {
  if (selected) {
    if (!draftSelectedFieldIds.value.includes(id)) {
      draftSelectedFieldIds.value = [...draftSelectedFieldIds.value, id];
    }
    return;
  }

  draftSelectedFieldIds.value = draftSelectedFieldIds.value.filter(
    (entry) => entry !== id,
  );
}

function onDragStart(id: number, event: DragEvent) {
  if (!selectedSet.value.has(id) || searchQuery.value.trim()) {
    return;
  }
  draggedId.value = id;
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", String(id));
  }
}

function onDragOver(id: number) {
  if (
    !selectedSet.value.has(id) ||
    !draggedId.value ||
    draggedId.value === id ||
    searchQuery.value.trim()
  ) {
    return;
  }
}

function onDrop(id: number) {
  if (
    !selectedSet.value.has(id) ||
    !draggedId.value ||
    draggedId.value === id ||
    searchQuery.value.trim()
  ) {
    onDragEnd();
    return;
  }

  const next = draftSelectedFieldIds.value.filter(
    (entry) => entry !== draggedId.value,
  );
  const targetIndex = next.indexOf(id);
  if (targetIndex >= 0) {
    next.splice(targetIndex, 0, draggedId.value);
    draftSelectedFieldIds.value = next;
  }
  onDragEnd();
}

function onDragEnd() {
  draggedId.value = null;
}

function saveDrafts() {
  emit("save-view-fields", {
    selectedFieldIds: [...draftSelectedFieldIds.value],
    groupingFieldId: draftGroupingFieldId.value,
  });
}

watch(
  () =>
    [
      props.selectedFieldIds,
      props.groupingFieldId,
      props.orderedFields,
    ] as const,
  () => {
    resetDrafts();
  },
  { immediate: true, deep: true },
);
</script>

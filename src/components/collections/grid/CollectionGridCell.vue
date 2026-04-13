<template>
  <div
    ref="cellRef"
    class="cell flex h-10 w-full items-center px-3 text-base text-[var(--text-primary)]"
    :class="isSelected ? 'ring-1 ring-inset ring-[var(--accent-primary)]' : ''"
    data-grid-cell
    @click="onSelect"
    @dblclick="onDoubleClick"
  >
    <template v-if="field?.type === 'select' && displayText !== '-'">
      <span class="inline-flex h-5 items-center rounded-full border px-2 py-3 text-base leading-none" :style="chipStyle">
        {{ displayText }}
      </span>
    </template>
    <template v-else-if="field?.type === 'multiselect' && multiselectDisplay.length > 0">
      <div class="flex items-center gap-1 overflow-hidden">
        <span
          v-for="option in multiselectDisplay"
          :key="option"
          class="inline-flex h-5 items-center rounded-full border px-2 py-3 text-base leading-none"
          :style="getMultiChipStyle(option)"
        >
          {{ option }}
        </span>
      </div>
    </template>
    <template v-else-if="field?.type === 'boolean'">
      <button type="button" class="flex items-center" @click.stop="toggleBoolean">
        <component
          :is="booleanIconComponent"
          :size="18"
          :fill="booleanValue ? 'currentColor' : 'transparent'"
          :stroke-width="booleanValue ? 0 : 1.5"
          :class="booleanValue ? 'text-[var(--primary)]' : 'text-[var(--text-muted)]'"
        />
      </button>
    </template>
    <template v-else-if="field?.type === 'url' && displayText !== '-'">
      <div class="flex items-center gap-1">
        <button
          type="button"
          :class="isDuplicate ? 'text-[var(--danger)]' : 'text-[var(--accent-primary)]'"
          title="Open link"
          @click.stop="openExternal(displayText as string)"
        >
          <Link :size="12" />
        </button>
        <span :class="['truncate', isDuplicate ? 'text-[var(--danger)]' : 'text-[var(--accent-primary)]']">
          {{ displayText }}
        </span>
      </div>
    </template>
    <template v-else-if="field?.type === 'rating' && ratingMax > 0">
      <div class="flex items-center">
        <component
          v-for="index in ratingMax"
          :key="index"
          :is="ratingIconComponent"
          :size="16"
          :fill="index <= ratingValue ? ratingColor : 'transparent'"
          :stroke-width="index <= ratingValue ? 0 : 1.5"
          :class="index <= ratingValue ? ratingFilledClass : 'text-[var(--text-muted)]'"
        />
      </div>
    </template>
    <template v-else>
      <span class="block w-full truncate" :class="field?.type === 'number' ? 'text-right' : ''" :style="displayStyle">
        {{ displayText }}
      </span>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, inject, ref } from "vue";
import * as icons from "lucide-vue-next";
import { Link } from "lucide-vue-next";
import type { BooleanIcon, DateFieldOptions, Field, ItemDataValue, RatingFieldOptions } from "../../../types/models";
import { systemRepository } from "../../../repositories/systemRepository";
import { formatDateWithFieldOptions, parseDateValue } from "../../../utils/date";
import { parseFieldOptions } from "../../../utils/fieldOptions";
import { normalizeUniqueKey } from "../../../utils/fieldUnique";
import { parseBooleanValue, parseMultiselectValue, parseRatingValue } from "../../../utils/fieldValues";
import { getChipStyle } from "../../../utils/selectChip";
import { gridEditingKey, gridSelectionKey } from "./types";

const props = defineProps<{
  field?: Field;
  value?: ItemDataValue;
  rowId: number;
  rowIndex: number;
  rowIds: number[];
  orderedFields: Field[];
  duplicateMap?: Map<string, Set<string>>;
}>();

const selection = inject(gridSelectionKey);
const editing = inject(gridEditingKey);

if (!selection || !editing) {
  throw new Error("Grid selection/editing context not provided");
}

const selectionContext = selection;
const editingContext = editing;
const cellRef = ref<HTMLElement | null>(null);

const fieldOptions = computed(() => (props.field ? parseFieldOptions(props.field.type, props.field.options) : null));
const dateOptions = computed<DateFieldOptions>(() => (fieldOptions.value ?? {}) as DateFieldOptions);
const ratingFieldOptions = computed<RatingFieldOptions>(() => (fieldOptions.value ?? {}) as RatingFieldOptions);
const selectOptions = computed(() => ((fieldOptions.value as { choices?: string[] } | null)?.choices ?? []));
const ratingMin = computed(() => (Number.isFinite(ratingFieldOptions.value.min) ? Number(ratingFieldOptions.value.min) : 0));
const ratingMax = computed(() => Math.max(Number.isFinite(ratingFieldOptions.value.max) ? Number(ratingFieldOptions.value.max) : 5, ratingMin.value));
const ratingColor = computed(() => ratingFieldOptions.value.color ?? "currentColor");
const ratingValue = computed(() => parseRatingValue(props.value ?? null) ?? 0);
const ratingIconComponent = computed(() => booleanIconMap[(ratingFieldOptions.value.icon ?? "star") as BooleanIcon]);
const booleanIconComponent = computed(() => booleanIconMap[((fieldOptions.value as { icon?: BooleanIcon })?.icon ?? "square") as BooleanIcon]);

const displayText = computed(() => {
  const field = props.field;
  const value = props.value;
  if (!field) return "-";
  if (value === null || value === undefined || value === "") return "-";
  if (field.type === "date") {
    return formatDateWithFieldOptions(value, dateOptions.value);
  }
  return value;
});

const shouldHighlightDate = computed(() => {
  const field = props.field;
  if (!field || field.type !== "date") return false;
  const highlight = dateOptions.value.highlight;
  if (!highlight || !highlight.type || !highlight.date || !highlight.color) return false;

  const valueDate = parseDateValue(props.value ?? null);
  const compareDate = parseDateValue(highlight.date);
  if (!valueDate || !compareDate) return false;

  return highlight.type === "<" ? valueDate.getTime() < compareDate.getTime() : valueDate.getTime() > compareDate.getTime();
});

const uniqueKey = computed(() => (props.field ? normalizeUniqueKey(props.field, props.value ?? null) : null));
const isDuplicate = computed(() => {
  if (!props.field || !uniqueKey.value || !props.duplicateMap) return false;
  return Boolean(props.duplicateMap.get(props.field.name)?.has(uniqueKey.value));
});

const displayStyle = computed(() => {
  if (isDuplicate.value) {
    return { color: "var(--danger)" };
  }
  if (shouldHighlightDate.value) {
    return { color: dateOptions.value.highlight?.color ?? undefined };
  }
  return {};
});

const ratingFilledClass = computed(() => (isDuplicate.value ? "text-[var(--danger)]" : "text-[var(--primary)]"));
const chipStyle = computed(() => getChipStyle(String(displayText.value), selectOptions.value));
const multiselectDisplay = computed(() => parseMultiselectValue(props.value ?? null));
const isSelected = computed(() => (props.field ? selectionContext.isSelected(props.rowId, props.field.name) : false));
const booleanValue = computed(() => parseBooleanValue(props.value ?? null));

function getMultiChipStyle(option: string) {
  return getChipStyle(option, selectOptions.value);
}

function onSelect() {
  if (!props.field) return;
  selectionContext.selectCell(props.rowId, props.field.name);
  if (props.field.type === "boolean") {
    toggleBoolean();
  }
}

function onDoubleClick() {
  if (!props.field) return;
  if (props.field.type === "boolean") {
    toggleBoolean();
    return;
  }

  editingContext.startEdit(props.rowId, props.field.name, cellRef.value);
}

function toggleBoolean() {
  if (!props.field) return;
  editingContext.startEdit(props.rowId, props.field.name, cellRef.value);
  void editingContext.commitEdit(booleanValue.value ? "0" : "1");
}

async function openExternal(url: string) {
  await systemRepository.openExternal(url);
}

const booleanIconMap: Record<BooleanIcon, typeof icons.Square> = {
  square: icons.Square,
  circle: icons.Circle,
  heart: icons.Heart,
  star: icons.Star,
  flame: icons.Flame,
  "thumbs-up": icons.ThumbsUp,
  "thumbs-down": icons.ThumbsDown,
  flag: icons.Flag,
};
</script>

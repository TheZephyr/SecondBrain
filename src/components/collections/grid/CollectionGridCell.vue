<template>
  <div
    ref="cellRef"
    class="cell flex h-10 w-full items-center px-2 text-base text-(--text-primary)"
    :class="isSelected ? 'ring-1 ring-inset ring-(--accent-primary)' : ''"
    data-grid-cell
    :data-row-id="rowId"
    :data-field-name="field?.name"
    @click="onSelect"
    @dblclick="onDoubleClick"
  >
    <template v-if="field?.type === 'select' && displayText">
      <span
        class="inline-flex h-5 items-center rounded-full px-2 pt-3 pb-3.5 text-base leading-none"
        :style="chipStyle"
      >
        {{ displayText }}
      </span>
    </template>
    <template
      v-else-if="field?.type === 'multiselect' && multiselectDisplay.length > 0"
    >
      <div class="flex items-center gap-1 overflow-hidden">
        <span
          v-for="option in multiselectDisplay"
          :key="option"
          class="inline-flex h-5 items-center rounded-full px-2 pt-3 pb-3.5 text-base leading-none"
          :style="getMultiChipStyle(option)"
        >
          {{ option }}
        </span>
      </div>
    </template>
    <template v-else-if="field?.type === 'boolean'">
      <InteractiveBooleanInput
        :modelValue="booleanValue"
        :icon="booleanIconName"
        :color="booleanColor"
        @update:modelValue="toggleBoolean"
      />
    </template>
    <template v-else-if="field?.type === 'url' && displayText">
      <div class="flex w-full min-w-0 items-center gap-1 overflow-hidden">
        <button
          type="button"
          :class="[
            'shrink-0 cursor-pointer',
            isDuplicate ? 'text-(--danger)' : 'text-(--accent-primary)',
          ]"
          title="Open link"
          @click.stop="openExternal(displayText as string)"
        >
          <Link :size="12" />
        </button>
        <span
          :class="[
            'min-w-0 flex-1 truncate',
            isDuplicate ? 'text-(--danger)' : 'text-(--accent-primary)',
          ]"
        >
          {{ displayText }}
        </span>
      </div>
    </template>
    <template v-else-if="field?.type === 'rating' && ratingMax > 0">
      <div class="flex items-center overflow-hidden">
        <InteractiveRatingInput
          :modelValue="ratingValue"
          :icon="ratingIcon"
          :color="ratingColor"
          :valueColors="ratingValueColors"
          :max="ratingMax"
          :filledClass="ratingFilledClass"
          @update:modelValue="commitRatingValue"
        />
      </div>
    </template>
    <template
      v-else-if="field?.type === 'number' && numberShowAsChip && displayText"
    >
      <span
        class="inline-flex h-5 items-center rounded-full border px-2 py-3 text-base leading-none"
        :style="numberChipStyle"
      >
        {{ displayText }}
      </span>
    </template>
    <template v-else>
      <span
        class="block w-full truncate"
        :class="field?.type === 'number' ? 'text-right' : ''"
        :style="displayStyle"
      >
        {{ displayText }}
      </span>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, inject, ref } from "vue";
import { Link } from "lucide-vue-next";
import InteractiveRatingInput from "@/components/collections/InteractiveRatingInput.vue";
import InteractiveBooleanInput from "@/components/collections/InteractiveBooleanInput.vue";
import type {
  BooleanIcon,
  BooleanFieldOptions,
  DateFieldOptions,
  Field,
  ItemDataValue,
  NumberFieldOptions,
  NumberFieldRange,
  RatingFieldOptions,
} from "../../../types/models";
import { systemRepository } from "../../../repositories/systemRepository";
import { formatDateWithFieldOptions } from "../../../utils/date";
import {
  formatNumberWithFieldOptions,
  resolveDateHighlightStyle,
  resolveNumberColorScaleStyle,
} from "../../../utils/fieldPresentation";
import {
  getRatingValueColor,
  getSelectChoiceColor,
  parseFieldOptions,
} from "../../../utils/fieldOptions";
import { normalizeUniqueKey } from "../../../utils/fieldUnique";
import {
  parseBooleanValue,
  parseMultiselectValue,
  parseRatingValue,
} from "../../../utils/fieldValues";
import { getChipStyle } from "../../../utils/selectChip";
import { gridEditingKey, gridSelectionKey } from "./types";

const props = defineProps<{
  field?: Field;
  value?: ItemDataValue;
  rowId: number;
  rowIndex: number;
  rowIds: number[];
  orderedFields: Field[];
  numberFieldRange?: NumberFieldRange;
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

const fieldOptions = computed(() =>
  props.field ? parseFieldOptions(props.field.type, props.field.options) : null,
);
const dateOptions = computed<DateFieldOptions>(
  () => (fieldOptions.value ?? {}) as DateFieldOptions,
);
const numberOptions = computed(
  () => (fieldOptions.value ?? {}) as NumberFieldOptions,
);
const ratingFieldOptions = computed<RatingFieldOptions>(
  () => (fieldOptions.value ?? {}) as RatingFieldOptions,
);
const selectOptions = computed(
  () => (fieldOptions.value as { choices?: string[] } | null)?.choices ?? [],
);
const ratingMin = computed(() =>
  Number.isFinite(ratingFieldOptions.value.min)
    ? Number(ratingFieldOptions.value.min)
    : 0,
);
const ratingMax = computed(() =>
  Math.max(
    Number.isFinite(ratingFieldOptions.value.max)
      ? Number(ratingFieldOptions.value.max)
      : 5,
    ratingMin.value,
  ),
);
const ratingValue = computed(() => parseRatingValue(props.value ?? null) ?? 0);
const ratingIcon = computed(
  () => (ratingFieldOptions.value.icon ?? "star") as BooleanIcon,
);
const ratingValueColors = computed(
  () => ratingFieldOptions.value.optionColors ?? {},
);
const ratingColor = computed(() =>
  props.field
    ? (getRatingValueColor(props.field, ratingValue.value) ??
      ratingFieldOptions.value.color ??
      "currentColor")
    : (ratingFieldOptions.value.color ?? "currentColor"),
);
const booleanIconName = computed(
  () =>
    ((fieldOptions.value as BooleanFieldOptions)?.icon ??
      "square") as BooleanIcon,
);
const booleanColor = computed(
  () => (fieldOptions.value as BooleanFieldOptions)?.color ?? "",
);
const numberShowAsChip = computed(() =>
  Boolean(numberOptions.value.showAsChip),
);

const displayText = computed(() => {
  const field = props.field;
  const value = props.value;
  if (!field) return "";
  if (value === null || value === undefined || value === "") return "";
  if (field.type === "date") {
    return formatDateWithFieldOptions(value, dateOptions.value);
  }
  if (field.type === "number") {
    return formatNumberWithFieldOptions(value, numberOptions.value);
  }
  return value;
});

const uniqueKey = computed(() =>
  props.field ? normalizeUniqueKey(props.field, props.value ?? null) : null,
);
const isDuplicate = computed(() => {
  if (!props.field || !uniqueKey.value || !props.duplicateMap) return false;
  return Boolean(
    props.duplicateMap.get(props.field.name)?.has(uniqueKey.value),
  );
});

const displayStyle = computed(() => {
  if (isDuplicate.value) {
    return { color: "var(--danger)" };
  }
  if (props.field?.type === "date") {
    return resolveDateHighlightStyle(props.value ?? null, dateOptions.value);
  }
  if (props.field?.type === "number") {
    return resolveNumberColorScaleStyle(
      props.value ?? null,
      numberOptions.value,
      props.numberFieldRange,
    );
  }
  return {};
});

const ratingFilledClass = computed(() =>
  isDuplicate.value ? "text-(--danger)" : "text-primary",
);
const chipStyle = computed(() =>
  getChipStyle(
    String(displayText.value),
    selectOptions.value,
    props.field
      ? {
          [String(displayText.value)]:
            getSelectChoiceColor(props.field, String(displayText.value)) ?? "",
        }
      : undefined,
  ),
);
const numberChipStyle = computed(() =>
  resolveNumberColorScaleStyle(
    props.value ?? null,
    numberOptions.value,
    props.numberFieldRange,
  ),
);
const multiselectDisplay = computed(() =>
  parseMultiselectValue(props.value ?? null),
);
const isSelected = computed(() =>
  props.field
    ? selectionContext.isSelected(props.rowId, props.field.name)
    : false,
);
const booleanValue = computed(() => parseBooleanValue(props.value ?? null));

function getMultiChipStyle(option: string) {
  return getChipStyle(
    option,
    selectOptions.value,
    props.field
      ? { [option]: getSelectChoiceColor(props.field, option) ?? "" }
      : undefined,
  );
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
  if (props.field.type === "rating") {
    return;
  }

  editingContext.startEdit(props.rowId, props.field.name, cellRef.value);
}

function toggleBoolean() {
  if (!props.field) return;
  editingContext.startEdit(props.rowId, props.field.name, cellRef.value);
  void editingContext.commitEdit(booleanValue.value ? "0" : "1");
}

function commitRatingValue(value: number | null) {
  if (!props.field) return;
  editingContext.startEdit(props.rowId, props.field.name, cellRef.value);
  void editingContext.commitEdit(value);
}

async function openExternal(url: string) {
  await systemRepository.openExternal(url);
}


</script>

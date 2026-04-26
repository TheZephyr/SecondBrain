<template>
  <div class="relative">
    <AppCard
      class="rounded-lg border border-[var(--border-color)] bg-[var(--bg-primary)] shadow-sm"
      draggable="true"
      data-kanban-card
      :data-item-id="item.id"
      @dragstart="onDragStart"
      @dragend="onDragEnd"
    >
      <div class="pr-6 text-sm font-semibold text-[var(--text-primary)]">
        {{ titleText }}
      </div>
      <div class="space-y-2">
        <div
          v-for="field in detailFields"
          :key="field.id"
          class="field-row flex items-start gap-2 text-sm"
        >
          <span class="inline-flex w-24 shrink-0 items-center gap-1 text-[var(--text-muted)]">
            <span class="truncate">{{ field.name }}</span>
            <FieldDescriptionHint :description="field.description" />
          </span>
          <span class="min-w-0 flex-1 text-[var(--text-primary)]">
            <template v-if="field.type === 'select'">
              <span
                v-if="getDisplayText(field)"
                class="inline-flex h-5 items-center rounded-full border px-2 py-0.5 text-xs leading-none"
                :style="getChipStyle(String(getDisplayText(field)), getSelectChoices(field), getOptionColors(field))"
              >
                {{ getDisplayText(field) }}
              </span>
              <span v-else class="text-[var(--text-muted)]">-</span>
            </template>
            <template v-else-if="field.type === 'multiselect'">
              <div v-if="getMultiValues(field).length > 0" class="flex flex-wrap gap-1">
                <span
                  v-for="option in getMultiValues(field)"
                  :key="option"
                  class="inline-flex h-5 items-center rounded-full border px-2 py-0.5 text-xs leading-none"
                  :style="getChipStyle(option, getSelectChoices(field), getOptionColors(field))"
                >
                  {{ option }}
                </span>
              </div>
              <span v-else class="text-[var(--text-muted)]">-</span>
            </template>
            <template v-else-if="field.type === 'number'">
              <span
                v-if="getDisplayText(field)"
                class="inline-flex items-center rounded-full border leading-none"
                :class="showNumberAsChip(field) ? 'h-5 px-2 py-0.5 text-xs' : 'border-transparent px-0 py-0 text-sm'"
                :style="getNumberStyle(field)"
              >
                {{ getDisplayText(field) }}
              </span>
              <span v-else class="text-[var(--text-muted)]">-</span>
            </template>
            <template v-else-if="field.type === 'boolean'">
              <component
                :is="getBooleanIcon(field)"
                :size="16"
                :fill="getBooleanValue(field) ? 'currentColor' : 'transparent'"
                :stroke-width="getBooleanValue(field) ? 0 : 1.5"
                :class="getBooleanValue(field) ? 'text-[var(--primary)]' : 'text-[var(--text-muted)]'"
              />
            </template>
            <template v-else-if="field.type === 'rating'">
              <InteractiveRatingInput
                v-if="getRatingMax(field) > 0"
                :modelValue="getRatingValue(field)"
                :icon="getRatingIconName(field)"
                :color="getRatingColor(field)"
                :valueColors="getRatingValueColors(field)"
                :max="getRatingMax(field)"
                :size="14"
                @update:modelValue="value => updateRating(field, value)"
              />
              <span v-else class="text-[var(--text-muted)]">-</span>
            </template>
            <template v-else>
              <span v-if="getDisplayText(field)" class="block truncate">
                {{ getDisplayText(field) }}
              </span>
              <span v-else class="text-[var(--text-muted)]">-</span>
            </template>
          </span>
        </div>
      </div>
    </AppCard>

    <DropdownMenu>
      <DropdownMenuTrigger as-child>
        <AppButton text class="absolute right-2 top-2 h-7 w-7 p-0">
          <template #icon>
            <EllipsisVertical class="size-4" />
          </template>
        </AppButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem @select="emit('edit', item)">Edit</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import * as icons from "lucide-vue-next";
import { EllipsisVertical } from "lucide-vue-next";
import AppButton from "@/components/app/ui/AppButton.vue";
import AppCard from "@/components/app/ui/AppCard.vue";
import FieldDescriptionHint from "@/components/collections/FieldDescriptionHint.vue";
import InteractiveRatingInput from "@/components/collections/InteractiveRatingInput.vue";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type {
  BooleanIcon,
  DateFieldOptions,
  Field,
  Item,
  NumberFieldOptions,
  NumberFieldRange,
  RatingFieldOptions,
} from "../../../types/models";
import { formatDateWithFieldOptions } from "../../../utils/date";
import {
  formatNumberWithFieldOptions,
  resolveNumberColorScaleStyle,
} from "../../../utils/fieldPresentation";
import {
  getRatingValueColor,
  getSelectChoices,
  getSelectOptionColors,
  parseFieldOptions,
} from "../../../utils/fieldOptions";
import {
  parseBooleanValue,
  parseMultiselectValue,
  parseRatingValue,
} from "../../../utils/fieldValues";
import { getChipStyle } from "../../../utils/selectChip";

const props = defineProps<{
  item: Item;
  viewOrderedFields: Field[];
  numberFieldRanges: Record<number, NumberFieldRange>;
}>();

const emit = defineEmits<{
  (e: "edit", value: Item): void;
  (e: "update-item", value: { id: number; data: Item["data"] }): void;
  (e: "drag-start", id: number): void;
}>();

const titleField = computed(() => props.viewOrderedFields[0] ?? null);
const titleText = computed(() => {
  const field = titleField.value;
  if (!field) {
    return `#${props.item.id}`;
  }
  return getDisplayText(field) || `#${props.item.id}`;
});

const detailFields = computed(() => props.viewOrderedFields.slice(1));

function getDisplayText(field: Field): string {
  const value = props.item.data[field.name];
  if (value === null || value === undefined || value === "") return "";

  if (field.type === "date") {
    return formatDateWithFieldOptions(
      value,
      parseFieldOptions(field.type, field.options) as DateFieldOptions,
    );
  }

  if (field.type === "number") {
    return formatNumberWithFieldOptions(
      value,
      parseFieldOptions(field.type, field.options) as NumberFieldOptions,
    );
  }

  return String(value);
}

function getBooleanValue(field: Field): boolean {
  return parseBooleanValue(props.item.data[field.name]);
}

function getBooleanIcon(field: Field) {
  return booleanIconMap[
    ((parseFieldOptions(field.type, field.options) as { icon?: BooleanIcon })
      .icon ?? "square") as BooleanIcon
  ];
}

function getMultiValues(field: Field): string[] {
  return parseMultiselectValue(props.item.data[field.name]);
}

function getRatingValue(field: Field): number | null {
  return parseRatingValue(props.item.data[field.name]);
}

function getRatingMax(field: Field) {
  const options = parseFieldOptions(field.type, field.options) as RatingFieldOptions;
  const min = Number.isFinite(options.min) ? Number(options.min) : 0;
  const max = Number.isFinite(options.max) ? Number(options.max) : 5;
  return Math.max(max, min);
}

function getRatingColor(field: Field) {
  return (
    getRatingValueColor(field, getRatingValue(field)) ??
    (parseFieldOptions(field.type, field.options) as RatingFieldOptions).color ??
    "currentColor"
  );
}

function getRatingValueColors(field: Field) {
  return (
    parseFieldOptions(field.type, field.options) as RatingFieldOptions
  ).optionColors ?? {};
}

function getRatingIconName(field: Field) {
  return ((parseFieldOptions(field.type, field.options) as RatingFieldOptions).icon ??
    "star") as BooleanIcon;
}

function showNumberAsChip(field: Field) {
  return Boolean(
    (parseFieldOptions(field.type, field.options) as { showAsChip?: boolean })
      .showAsChip,
  );
}

function getNumberStyle(field: Field) {
  if (!showNumberAsChip(field)) {
    return {};
  }

  return resolveNumberColorScaleStyle(
    props.item.data[field.name],
    parseFieldOptions(field.type, field.options) as NumberFieldOptions,
    props.numberFieldRanges[field.id],
  );
}

function getOptionColors(field: Field) {
  return getSelectOptionColors(field);
}

function updateRating(field: Field, value: number | null) {
  emit("update-item", {
    id: props.item.id,
    data: {
      ...props.item.data,
      [field.name]: value,
    },
  });
}

function onDragStart(event: DragEvent) {
  if (event.dataTransfer) {
    event.dataTransfer.setData("text/plain", String(props.item.id));
    event.dataTransfer.effectAllowed = "move";
  }
  emit("drag-start", props.item.id);
}

function onDragEnd() {
  // no-op
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

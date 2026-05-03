<template>
  <Teleport to="body">
    <div
      v-if="isEditing && activeField"
      ref="overlayRef"
      :style="[overlayStyle, overlaySurfaceStyle]"
      class="z-50 ring-1 ring-inset ring-(--accent-primary)"
      :class="{
        'flex items-center': isTextLikeField || activeField?.type === 'number',
        'overflow-hidden rounded-[2px]': activeField?.type === 'select' || activeField?.type === 'multiselect',
      }"
      tabindex="0"
      @keydown="onKeydown"
      @focusout="onOverlayFocusOut"
      @mousedown.stop
    >
      <input
        v-if="isTextLikeField"
        ref="inputRef"
        v-model="textModel"
        type="text"
        class="h-full w-full bg-transparent px-2 text-base outline-none"
        @blur="onInputBlur"
      />
      <input
        v-else-if="activeField.type === 'number'"
        ref="inputRef"
        v-model="numberModel"
        type="number"
        class="h-full w-full bg-transparent px-2 text-base text-right outline-none"
        @blur="onInputBlur"
      />
      <!-- Select dropdown -->
      <div
        v-else-if="activeField.type === 'select'"
        class="flex max-h-60 flex-col overflow-hidden bg-(--bg-tertiary)"
      >
        <ul class="overflow-auto py-1">
          <li
            v-if="selectOptions.length === 0"
            class="px-3 py-2 text-base text-(--text-muted)"
          >
            No options
          </li>
          <li v-for="option in selectOptions" v-else :key="option">
            <button
              type="button"
              class="group flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-base transition-colors hover:bg-(--bg-secondary)"
              :class="option === selectModel ? 'bg-(--bg-secondary)' : ''"
              @click="commitSelect(option)"
            >
              <span
                class="inline-flex h-5 items-center rounded-full px-2 pt-3 pb-3.5 text-base leading-none"
                :style="getOptionChipStyle(option)"
              >
                {{ option }}
              </span>
              <Check
                v-if="option === selectModel"
                :size="14"
                class="ml-auto shrink-0 text-(--accent-primary)"
              />
            </button>
          </li>
        </ul>
      </div>

      <!-- Multiselect dropdown -->
      <div
        v-else-if="activeField.type === 'multiselect'"
        class="flex max-h-72 flex-col overflow-hidden bg-(--bg-tertiary)"
      >
        <!-- Selected chips strip -->
        <div
          v-if="multiselectModel.length > 0"
          class="flex flex-wrap gap-1 border-b border-(--border-color) px-2.5 py-2"
        >
          <span
            v-for="selected in multiselectModel"
            :key="selected"
            class="inline-flex h-5 items-center rounded-full px-2 pt-3 pb-3.5 text-base leading-none"
            :style="getOptionChipStyle(selected)"
          >
            {{ selected }}
          </span>
        </div>
        <!-- Options list -->
        <ul class="overflow-auto py-1">
          <li
            v-if="selectOptions.length === 0"
            class="px-3 py-2 text-base text-(--text-muted)"
          >
            No options
          </li>
          <li v-for="option in selectOptions" v-else :key="option">
            <button
              type="button"
              class="group flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-base transition-colors hover:bg-(--bg-secondary)"
              :class="isMultiSelected(option) ? 'bg-(--bg-secondary)' : ''"
              @click="toggleMulti(option)"
            >
              <span
                class="inline-flex h-5 items-center rounded-full px-2 pt-3 pb-3.5 text-base leading-none"
                :style="getOptionChipStyle(option)"
              >
                {{ option }}
              </span>
              <Check
                v-if="isMultiSelected(option)"
                :size="14"
                class="ml-auto shrink-0 text-(--accent-primary)"
              />
            </button>
          </li>
        </ul>
      </div>
      <ul
        v-else-if="activeField.type === 'rating'"
        class="max-h-60 overflow-auto py-1"
      >
        <li v-for="option in ratingSelectOptions" :key="String(option.value)">
          <button
            type="button"
            class="flex w-full items-center gap-2 px-3 py-2 text-left text-base hover:bg-(--surface-2)"
            :class="
              option.value === ratingModel ? 'bg-(--surface-2) font-medium' : ''
            "
            @click="commitRating(option.value)"
          >
            <span v-if="option.value === null" class="text-(--text-muted)"
              >None</span
            >
            <div v-else class="flex items-center">
              <component
                v-for="index in ratingMax"
                :key="index"
                :is="ratingIconComponent"
                :size="16"
                :fill="
                  index <= option.value
                    ? getRatingColor(option.value)
                    : 'transparent'
                "
                :stroke-width="index <= option.value ? 0 : 1.5"
                :class="
                  index <= option.value
                    ? 'text-(--text-primary)'
                    : 'text-(--text-muted)'
                "
              />
            </div>
          </button>
        </li>
      </ul>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import {
  computed,
  inject,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
} from "vue";
import type {
  BooleanIcon,
  DateFieldOptions,
  Field,
  Item,
  ItemDataValue,
  RatingFieldOptions,
} from "../../../types/models";
import { gridEditingKey, gridSelectionKey } from "./types";
import { parseGridCellKey } from "../../../composables/collection/grid/useGridSelection";
import {
  formatDateWithFieldOptions,
  parseDateValue,
} from "../../../utils/date";
import { parseFieldOptions } from "../../../utils/fieldOptions";
import {
  parseMultiselectValue,
  parseRatingValue,
} from "../../../utils/fieldValues";
import { Check } from "lucide-vue-next";
import * as icons from "lucide-vue-next";
import { getChipStyle } from "../../../utils/selectChip";
import { getSelectChoiceColor } from "../../../utils/fieldOptions";

type EditValue = ItemDataValue | Date | string[] | null;
type GridCellTarget = { rowId: number; fieldName: string };

const props = defineProps<{
  items: Item[];
  orderedFields: Field[];
  rowIds: number[];
}>();

const selection = inject(gridSelectionKey);
const editing = inject(gridEditingKey);

if (!selection || !editing) {
  throw new Error("Grid selection/editing context not provided");
}

const selectionContext = selection;
const editingContext = editing;

const overlayRef = ref<HTMLElement | null>(null);
const inputRef = ref<HTMLInputElement | null>(null);
const overlayStyle = ref<Record<string, string>>({});
const editValue = ref<EditValue>("");

const parsedCell = computed(() =>
  parseGridCellKey(editingContext.editingCellKey.value),
);
const isEditing = computed(() => parsedCell.value !== null);

const activeField = computed(() => {
  const parsed = parsedCell.value;
  if (!parsed) {
    return null;
  }

  return (
    props.orderedFields.find((field) => field.name === parsed.fieldName) ?? null
  );
});

const activeItem = computed(() => {
  const parsed = parsedCell.value;
  if (!parsed) {
    return null;
  }

  return props.items.find((item) => item.id === parsed.rowId) ?? null;
});

const currentValue = computed(() => {
  const field = activeField.value;
  const item = activeItem.value;
  if (!field || !item) {
    return null;
  }

  return item.data[field.name] ?? null;
});

const fieldOptions = computed(() =>
  activeField.value
    ? parseFieldOptions(activeField.value.type, activeField.value.options)
    : null,
);

const selectOptions = computed(() => {
  const options = fieldOptions.value as { choices?: string[] } | null;
  return options?.choices ?? [];
});

const ratingFieldOptions = computed<RatingFieldOptions>(
  () => (fieldOptions.value ?? {}) as RatingFieldOptions,
);

const ratingMin = computed(() =>
  Number.isFinite(ratingFieldOptions.value.min)
    ? Number(ratingFieldOptions.value.min)
    : 0,
);

const ratingMax = computed(() => {
  const max = Number.isFinite(ratingFieldOptions.value.max)
    ? Number(ratingFieldOptions.value.max)
    : 5;
  return Math.max(max, ratingMin.value);
});

const ratingColor = computed(
  () => ratingFieldOptions.value.color ?? "currentColor",
);
const ratingValueColors = computed(
  () => ratingFieldOptions.value.optionColors ?? {},
);

const ratingIconComponent = computed(() => {
  const icon = (ratingFieldOptions.value.icon ?? "star") as BooleanIcon;
  return booleanIconMap[icon];
});

const isTextLikeField = computed(
  () =>
    activeField.value?.type === "text" ||
    activeField.value?.type === "longtext" ||
    activeField.value?.type === "url" ||
    activeField.value?.type === "date",
);

const textModel = computed<string>({
  get: () => (editValue.value ?? "") as string,
  set: (value) => {
    editValue.value = value;
  },
});

const numberModel = computed<number | null>({
  get: () => {
    const value = editValue.value;
    if (value === null || value === undefined || value === "") return null;
    if (typeof value === "number") return Number.isFinite(value) ? value : null;
    if (typeof value === "string") {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : null;
    }
    return null;
  },
  set: (value) => {
    editValue.value = value ?? null;
  },
});

const selectModel = computed<string>({
  get: () => {
    const value = editValue.value;
    if (value === null || value === undefined) return "";
    return String(value);
  },
  set: (value) => {
    editValue.value = value;
  },
});

const multiselectModel = computed<string[]>({
  get: () => {
    if (Array.isArray(editValue.value)) return editValue.value;
    return parseMultiselectValue(editValue.value as ItemDataValue);
  },
  set: (value) => {
    editValue.value = value;
  },
});

const ratingModel = computed<number | null>({
  get: () => parseRatingValue(editValue.value as ItemDataValue),
  set: (value) => {
    editValue.value = value;
  },
});

const ratingSelectOptions = computed(() => {
  const options: Array<{ label: string; value: number | null }> = [
    { label: "None", value: null },
  ];

  for (let i = ratingMin.value; i <= ratingMax.value; i += 1) {
    options.push({ label: `${i} / ${ratingMax.value} *`, value: i });
  }

  return options;
});

const overlaySurfaceStyle = computed(() => ({
  backgroundColor: "var(--bg-secondary, #ffffff)",
  color: "var(--text-primary, #111111)",
}));

function resolveEditValue(
  value: ItemDataValue | null,
  field: Field,
): EditValue {
  if (field.type === "date") {
    const parsed = parseDateValue(value ?? null);
    if (!parsed) return "";
    return formatDateWithFieldOptions(
      parsed,
      (fieldOptions.value ?? {}) as DateFieldOptions,
    );
  }

  if (field.type === "number") {
    if (value === null || value === undefined || value === "") return null;
    if (typeof value === "number") return Number.isFinite(value) ? value : null;
    if (typeof value === "string") {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : null;
    }
    return null;
  }

  if (field.type === "multiselect") {
    return parseMultiselectValue(value ?? null);
  }

  if (field.type === "rating") {
    return parseRatingValue(value ?? null);
  }

  return value ?? "";
}

function getRatingColor(value: number | null): string {
  if (typeof value === "number" && Number.isFinite(value)) {
    const optionColor = ratingValueColors.value[String(value)];
    if (typeof optionColor === "string" && optionColor.trim().length > 0) {
      return optionColor;
    }
  }

  return ratingColor.value;
}

function updateOverlayPosition(): boolean {
  let activeCellElement = editingContext.activeCellElement.value;

  if (!activeCellElement) {
    const parsed = parsedCell.value;
    if (parsed) {
      activeCellElement = document.querySelector(
        `[data-grid-cell][data-row-id="${parsed.rowId}"][data-field-name="${parsed.fieldName}"]`,
      ) as HTMLElement | null;

      if (activeCellElement) {
        editingContext.activeCellElement.value = activeCellElement;
      }
    }
  }

  if (!activeCellElement) {
    overlayStyle.value = { display: "none" };
    return false;
  }

  const rect = activeCellElement.getBoundingClientRect();
  overlayStyle.value = {
    position: "fixed",
    top: `${rect.top}px`,
    left: `${rect.left}px`,
    width: `${rect.width}px`,
    minHeight: `${rect.height}px`,
  };

  return true;
}

function focusOverlay() {
  if (!activeField.value) {
    return;
  }

  const doFocus = () => {
    if (
      activeField.value?.type === "select" ||
      activeField.value?.type === "multiselect" ||
      activeField.value?.type === "rating"
    ) {
      overlayRef.value?.focus();
      return;
    }

    inputRef.value?.focus();
    inputRef.value?.select();
  };

  nextTick(() => {
    const positionUpdated = updateOverlayPosition();

    if (!positionUpdated) {
      // Retry in the next frame if the virtual list hasn't rendered it yet
      requestAnimationFrame(() => {
        if (updateOverlayPosition()) {
          doFocus();
        }
      });
      return;
    }

    doFocus();
  });
}

async function commitCurrentValue(nextCell?: GridCellTarget | null) {
  await editingContext.commitEdit(editValue.value);
  if (nextCell) {
    selectionContext.selectCell(nextCell.rowId, nextCell.fieldName);
  }
}

function cancelEdit() {
  editingContext.cancelEdit();
}

function getNextCell(): GridCellTarget | null {
  const parsed = parsedCell.value;
  const field = activeField.value;
  if (!parsed || !field || props.orderedFields.length === 0) {
    return null;
  }

  const fieldIndex = props.orderedFields.findIndex(
    (entry) => entry.name === field.name,
  );
  if (fieldIndex === -1) {
    return null;
  }

  if (fieldIndex < props.orderedFields.length - 1) {
    return {
      rowId: parsed.rowId,
      fieldName: props.orderedFields[fieldIndex + 1].name,
    };
  }

  const rowIndex = props.rowIds.indexOf(parsed.rowId);
  if (rowIndex >= 0 && rowIndex < props.rowIds.length - 1) {
    return {
      rowId: props.rowIds[rowIndex + 1],
      fieldName: props.orderedFields[0].name,
    };
  }

  return null;
}

function onInputBlur() {
  if (!isEditing.value) {
    return;
  }

  void commitCurrentValue();
}

function onOverlayFocusOut(event: FocusEvent) {
  const nextTarget = event.relatedTarget;
  if (nextTarget instanceof Node && overlayRef.value?.contains(nextTarget)) {
    return;
  }

  if (
    activeField.value?.type === "select" ||
    activeField.value?.type === "multiselect" ||
    activeField.value?.type === "rating"
  ) {
    void commitCurrentValue();
  }
}

function isMultiSelected(option: string) {
  return multiselectModel.value.includes(option);
}

function getOptionChipStyle(option: string): Record<string, string> {
  const field = activeField.value;
  return getChipStyle(
    option,
    selectOptions.value,
    field
      ? { [option]: getSelectChoiceColor(field, option) ?? "" }
      : undefined,
  );
}

function toggleMulti(option: string) {
  const current = multiselectModel.value;
  if (current.includes(option)) {
    multiselectModel.value = current.filter((entry) => entry !== option);
    return;
  }

  multiselectModel.value = [...current, option];
}

function commitSelect(option: string) {
  editValue.value = option;
  void commitCurrentValue();
}

function commitRating(value: number | null) {
  editValue.value = value;
  void commitCurrentValue();
}

function onKeydown(event: KeyboardEvent) {
  if (!isEditing.value) {
    return;
  }

  if (event.key === "Enter") {
    event.preventDefault();
    void commitCurrentValue();
    return;
  }

  if (event.key === "Escape") {
    event.preventDefault();
    cancelEdit();
    return;
  }

  if (event.key === "Tab" && !event.shiftKey) {
    event.preventDefault();
    void commitCurrentValue(getNextCell());
  }
}

function handleViewportChange() {
  if (!isEditing.value) {
    return;
  }

  updateOverlayPosition();
}

watch(
  [() => editingContext.editingCellKey.value, activeField, currentValue],
  () => {
    if (!activeField.value) {
      editValue.value = "";
      return;
    }

    editValue.value = resolveEditValue(
      currentValue.value as ItemDataValue | null,
      activeField.value,
    );
    focusOverlay();
  },
  { flush: "post" },
);

onMounted(() => {
  window.addEventListener("resize", handleViewportChange);
  document.addEventListener("scroll", handleViewportChange, true);
});

onBeforeUnmount(() => {
  window.removeEventListener("resize", handleViewportChange);
  document.removeEventListener("scroll", handleViewportChange, true);
});

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

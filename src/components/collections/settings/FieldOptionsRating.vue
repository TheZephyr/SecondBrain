<template>
  <div>
    <div class="mb-2 text-base font-semibold uppercase text-(--text-muted)">
      Icon
    </div>
    <div class="grid grid-cols-2 gap-2 sm:grid-cols-4">
      <button
        v-for="icon in booleanIcons"
        :key="icon"
        type="button"
        class="flex items-center justify-center gap-2 rounded-md border border-(--border-color) p-2"
        :class="ratingIcon === icon ? 'bg-(--bg-hover)' : ''"
        @click="updateRatingIcon(icon)"
      >
        <component
          :is="booleanIconMap[icon]"
          :size="18"
          class="text-(--text-muted)"
        />
        <component
          :is="booleanIconMap[icon]"
          :size="18"
          fill="currentColor"
          :stroke-width="0"
          class="text-(--text-primary)"
        />
      </button>
    </div>
  </div>

  <div class="mt-4">
    <div class="mb-1 text-base font-semibold uppercase text-(--text-muted)">
      Default Colour
    </div>
    <div class="flex flex-wrap items-center gap-2">
      <input
        type="color"
        :value="normalizeColor(ratingColor)"
        class="h-9 w-12 cursor-pointer rounded-md border border-(--border-color) bg-transparent p-1"
        @input="
          (event) => updateRatingColor((event.target as HTMLInputElement).value)
        "
      />
      <AppInput
        :modelValue="ratingColor"
        placeholder="currentColor"
        class="w-32"
        @update:modelValue="updateRatingColor"
      />
      <button
        v-for="color in paletteColors"
        :key="`default-${color}`"
        type="button"
        class="size-6 rounded-full border border-(--border-color)"
        :style="{ backgroundColor: color }"
        :title="color"
        @click="updateRatingColor(color)"
      />
    </div>
  </div>

  <div class="mt-4">
    <div class="mb-2 text-base font-semibold uppercase text-(--text-muted)">
      Value Colours
    </div>
    <div class="space-y-3">
      <div
        v-for="value in ratingValues"
        :key="value"
        class="space-y-2 rounded-md border border-(--border-color) p-3"
      >
        <div class="text-sm font-medium text-(--text-primary)">
          {{ value }}
        </div>
        <div class="flex flex-wrap items-center gap-2">
          <input
            type="color"
            :value="normalizeColor(getValueColor(value))"
            class="h-9 w-12 cursor-pointer rounded-md border border-(--border-color) bg-transparent p-1"
            @input="
              (event) =>
                updateValueColor(
                  value,
                  (event.target as HTMLInputElement).value,
                )
            "
          />
          <AppInput
            :modelValue="getValueColor(value)"
            placeholder="#000000"
            class="w-32"
            @update:modelValue="
              (valueText) => updateValueColor(value, valueText ?? '')
            "
          />
          <button
            v-for="color in paletteColors"
            :key="`${value}-${color}`"
            type="button"
            class="size-6 rounded-full border border-(--border-color)"
            :style="{ backgroundColor: color }"
            :title="color"
            @click="updateValueColor(value, color)"
          />
          <AppButton text class="h-8 px-2" @click="clearValueColor(value)"
            >Clear</AppButton
          >
        </div>
      </div>
    </div>
  </div>

  <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
    <div>
      <div class="mb-1 text-base font-semibold uppercase text-(--text-muted)">
        Min
      </div>
      <AppNumberField
        :modelValue="ratingMin"
        inputClass="w-full"
        class="w-full"
        @update:modelValue="updateRatingMin"
      />
    </div>
    <div>
      <div class="mb-1 text-base font-semibold uppercase text-(--text-muted)">
        Max
      </div>
      <AppNumberField
        :modelValue="ratingMax"
        inputClass="w-full"
        class="w-full"
        @update:modelValue="updateRatingMax"
      />
    </div>
  </div>

  <div class="mt-4">
    <div class="mb-1 text-base font-semibold uppercase text-(--text-muted)">
      Default Value
    </div>
    <AppSelect
      :modelValue="ratingDefault"
      :options="ratingDefaultOptions"
      optionLabel="label"
      optionValue="value"
      class="w-full"
      @update:modelValue="updateDefaultValue"
    />
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import * as icons from "lucide-vue-next";
import AppInput from "@/components/app/ui/AppInput.vue";
import AppNumberField from "@/components/app/ui/AppNumberField.vue";
import AppSelect from "@/components/app/ui/AppSelect.vue";
import type { BooleanIcon, RatingFieldOptions } from "../../../types/models";

const props = defineProps<{
  modelValue: RatingFieldOptions;
}>();

const emit = defineEmits<{
  (e: "update:modelValue", value: RatingFieldOptions): void;
}>();

const booleanIcons: BooleanIcon[] = [
  "square",
  "circle",
  "heart",
  "star",
  "flame",
  "thumbs-up",
  "thumbs-down",
  "flag",
];
const paletteColors = [
  "#ef4444",
  "#f97316",
  "#f59e0b",
  "#84cc16",
  "#10b981",
  "#06b6d4",
  "#3b82f6",
  "#a855f7",
];
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

const ratingMin = computed(() =>
  Number.isFinite(props.modelValue.min) ? Number(props.modelValue.min) : 0,
);
const ratingMax = computed(() =>
  Math.max(
    Number.isFinite(props.modelValue.max) ? Number(props.modelValue.max) : 5,
    ratingMin.value,
  ),
);
const ratingColor = computed(() => props.modelValue.color ?? "currentColor");
const ratingIcon = computed(
  () => (props.modelValue.icon ?? "star") as BooleanIcon,
);
const ratingDefault = computed(() => props.modelValue.defaultValue ?? null);
const ratingValueColors = computed(() => props.modelValue.optionColors ?? {});
const ratingDefaultOptions = computed(() => {
  const options: Array<{ label: string; value: number | null }> = [
    { label: "None", value: null },
  ];
  for (let i = ratingMin.value; i <= ratingMax.value; i += 1) {
    options.push({ label: `${i} / ${ratingMax.value} *`, value: i });
  }
  return options;
});
const ratingValues = computed(() => {
  const values: number[] = [];
  for (let i = ratingMin.value; i <= ratingMax.value; i += 1) {
    values.push(i);
  }
  return values;
});

function emitOptions(next: RatingFieldOptions) {
  emit("update:modelValue", next);
}

function normalizeColor(value: string) {
  return /^#[\da-fA-F]{6}$/.test(value.trim()) ? value.trim() : "#000000";
}

function updateDefaultValue(value: string | number | null) {
  emitOptions({
    ...props.modelValue,
    defaultValue: typeof value === "number" ? value : null,
  });
}

function updateRatingIcon(icon: BooleanIcon) {
  emitOptions({ ...props.modelValue, icon });
}

function updateRatingColor(value: string) {
  emitOptions({ ...props.modelValue, color: value ?? "" });
}

function getValueColor(value: number) {
  return ratingValueColors.value[String(value)] ?? "";
}

function updateValueColor(value: number, color: string | null | undefined) {
  const trimmed = typeof color === "string" ? color.trim() : "";
  const nextOptionColors = { ...ratingValueColors.value };

  if (!trimmed) {
    delete nextOptionColors[String(value)];
  } else {
    nextOptionColors[String(value)] = trimmed;
  }

  emitOptions({
    ...props.modelValue,
    optionColors: nextOptionColors,
  });
}

function clearValueColor(value: number) {
  updateValueColor(value, "");
}

function updateRatingMin(value: number | null) {
  const min = Number.isFinite(value) ? Number(value) : 0;
  const max = Math.max(ratingMax.value, min);
  const nextOptionColors = { ...ratingValueColors.value };
  for (const key of Object.keys(nextOptionColors)) {
    const numericKey = Number(key);
    if (!Number.isFinite(numericKey) || numericKey < min || numericKey > max) {
      delete nextOptionColors[key];
    }
  }

  const next: RatingFieldOptions = {
    ...props.modelValue,
    min,
    max,
    optionColors: nextOptionColors,
  };
  if (
    next.defaultValue !== undefined &&
    next.defaultValue !== null &&
    (next.defaultValue < min || next.defaultValue > max)
  ) {
    next.defaultValue = null;
  }
  emitOptions(next);
}

function updateRatingMax(value: number | null) {
  const min = ratingMin.value;
  const max = Math.max(Number.isFinite(value) ? Number(value) : 5, min);
  const nextOptionColors = { ...ratingValueColors.value };
  for (const key of Object.keys(nextOptionColors)) {
    const numericKey = Number(key);
    if (!Number.isFinite(numericKey) || numericKey < min || numericKey > max) {
      delete nextOptionColors[key];
    }
  }

  const next: RatingFieldOptions = {
    ...props.modelValue,
    min,
    max,
    optionColors: nextOptionColors,
  };
  if (
    next.defaultValue !== undefined &&
    next.defaultValue !== null &&
    (next.defaultValue < min || next.defaultValue > max)
  ) {
    next.defaultValue = null;
  }
  emitOptions(next);
}
</script>

<template>
  <div>
    <div class="mb-2 text-base font-semibold uppercase text-[var(--text-muted)]">Icon</div>
    <div class="grid grid-cols-2 gap-2 sm:grid-cols-4">
      <button
        v-for="icon in booleanIcons"
        :key="icon"
        type="button"
        class="flex items-center justify-center gap-2 rounded-md border border-[var(--border-color)] p-2"
        :class="ratingIcon === icon ? 'bg-[var(--bg-hover)]' : ''"
        @click="updateRatingIcon(icon)"
      >
        <component :is="booleanIconMap[icon]" :size="18" class="text-[var(--text-muted)]" />
        <component
          :is="booleanIconMap[icon]"
          :size="18"
          fill="currentColor"
          :stroke-width="0"
          class="text-[var(--text-primary)]"
        />
      </button>
    </div>
  </div>

  <div class="mt-4">
    <div class="mb-1 text-base font-semibold uppercase text-[var(--text-muted)]">Colour</div>
    <AppInput :modelValue="ratingColor" placeholder="currentColor" class="w-full" @update:modelValue="updateRatingColor" />
  </div>

  <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
    <div>
      <div class="mb-1 text-base font-semibold uppercase text-[var(--text-muted)]">Min</div>
      <AppNumberField :modelValue="ratingMin" inputClass="w-full" class="w-full" @update:modelValue="updateRatingMin" />
    </div>
    <div>
      <div class="mb-1 text-base font-semibold uppercase text-[var(--text-muted)]">Max</div>
      <AppNumberField :modelValue="ratingMax" inputClass="w-full" class="w-full" @update:modelValue="updateRatingMax" />
    </div>
  </div>

  <div class="mt-4">
    <div class="mb-1 text-base font-semibold uppercase text-[var(--text-muted)]">Default Value</div>
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

const booleanIcons: BooleanIcon[] = ["square", "circle", "heart", "star", "flame", "thumbs-up", "thumbs-down", "flag"];
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

const ratingMin = computed(() => (Number.isFinite(props.modelValue.min) ? Number(props.modelValue.min) : 0));
const ratingMax = computed(() => Math.max(Number.isFinite(props.modelValue.max) ? Number(props.modelValue.max) : 5, ratingMin.value));
const ratingColor = computed(() => props.modelValue.color ?? "currentColor");
const ratingIcon = computed(() => (props.modelValue.icon ?? "star") as BooleanIcon);
const ratingDefault = computed(() => props.modelValue.defaultValue ?? null);
const ratingDefaultOptions = computed(() => {
  const options: Array<{ label: string; value: number | null }> = [{ label: "None", value: null }];
  for (let i = ratingMin.value; i <= ratingMax.value; i += 1) {
    options.push({ label: `${i} / ${ratingMax.value} *`, value: i });
  }
  return options;
});

function emitOptions(next: RatingFieldOptions) {
  emit("update:modelValue", next);
}

function updateDefaultValue(value: string | number | null) {
  emitOptions({ ...props.modelValue, defaultValue: typeof value === "number" ? value : null });
}

function updateRatingIcon(icon: BooleanIcon) {
  emitOptions({ ...props.modelValue, icon });
}

function updateRatingColor(value: string) {
  emitOptions({ ...props.modelValue, color: value ?? "" });
}

function updateRatingMin(value: number | null) {
  const min = Number.isFinite(value) ? Number(value) : 0;
  const max = Math.max(ratingMax.value, min);
  const next: RatingFieldOptions = { ...props.modelValue, min, max };
  if (next.defaultValue !== undefined && next.defaultValue !== null && (next.defaultValue < min || next.defaultValue > max)) {
    next.defaultValue = null;
  }
  emitOptions(next);
}

function updateRatingMax(value: number | null) {
  const min = ratingMin.value;
  const max = Math.max(Number.isFinite(value) ? Number(value) : 5, min);
  const next: RatingFieldOptions = { ...props.modelValue, min, max };
  if (next.defaultValue !== undefined && next.defaultValue !== null && (next.defaultValue < min || next.defaultValue > max)) {
    next.defaultValue = null;
  }
  emitOptions(next);
}
</script>

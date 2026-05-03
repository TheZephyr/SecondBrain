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
        :class="booleanIcon === icon ? 'bg-(--bg-hover)' : ''"
        @click="updateBooleanIcon(icon)"
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
      Colour
    </div>
    <div class="flex flex-wrap items-center gap-2">
      <input
        type="color"
        :value="normalizeColor(booleanColor)"
        class="h-9 w-12 cursor-pointer rounded-md border border-(--border-color) bg-transparent p-1"
        @input="
          (event) => updateBooleanColor((event.target as HTMLInputElement).value)
        "
      />
      <AppInput
        :modelValue="booleanColor"
        placeholder="currentColor"
        class="w-32"
        @update:modelValue="updateBooleanColor"
      />
      <button
        v-for="color in paletteColors"
        :key="`boolean-${color}`"
        type="button"
        class="size-6 rounded-full border border-(--border-color)"
        :style="{ backgroundColor: color }"
        :title="color"
        @click="updateBooleanColor(color)"
      />
      <AppButton text class="h-8 px-2" @click="updateBooleanColor('')"
        >Clear</AppButton
      >
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import * as icons from "lucide-vue-next";
import AppButton from "@/components/app/ui/AppButton.vue";
import AppInput from "@/components/app/ui/AppInput.vue";
import type { BooleanIcon, BooleanFieldOptions } from "../../../types/models";

const props = defineProps<{
  modelValue: BooleanFieldOptions;
}>();

const emit = defineEmits<{
  (e: "update:modelValue", value: BooleanFieldOptions): void;
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

const booleanIcon = computed(
  () => (props.modelValue.icon ?? "square") as BooleanIcon,
);

const booleanColor = computed(() => props.modelValue.color ?? "");

function emitOptions(next: BooleanFieldOptions) {
  emit("update:modelValue", next);
}

function normalizeColor(value: string) {
  return /^#[\da-fA-F]{6}$/.test(value.trim()) ? value.trim() : "#000000";
}

function updateBooleanIcon(icon: BooleanIcon) {
  emitOptions({ ...props.modelValue, icon });
}

function updateBooleanColor(value: string | null | undefined) {
  emitOptions({ ...props.modelValue, color: value ?? "" });
}
</script>

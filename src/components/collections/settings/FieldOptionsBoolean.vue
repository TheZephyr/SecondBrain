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
</template>

<script setup lang="ts">
import { computed } from "vue";
import * as icons from "lucide-vue-next";
import type { BooleanIcon } from "../../../types/models";

const props = defineProps<{
  modelValue: { icon?: BooleanIcon };
}>();

const emit = defineEmits<{
  (e: "update:modelValue", value: { icon?: BooleanIcon }): void;
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

function emitOptions(next: { icon?: BooleanIcon }) {
  emit("update:modelValue", next);
}

function updateBooleanIcon(icon: BooleanIcon) {
  emitOptions({ ...props.modelValue, icon });
}
</script>

<template>
  <div class="flex items-center gap-0" @mouseleave="hoverValue = null">
    <button
      v-for="index in safeMax"
      :key="index"
      type="button"
      class="flex shrink-0 items-center"
      :title="String(index)"
      @mouseenter="hoverValue = index"
      @focus="hoverValue = index"
      @blur="hoverValue = null"
      @click.stop="commitValue(index)"
    >
      <component
        :is="iconComponent"
        :size="size"
        :fill="index <= activeValue ? colorValue : 'transparent'"
        :stroke-width="index <= activeValue ? 0 : 1.5"
        :class="[
          index <= activeValue ? filledClass : emptyClass,
          isHoverPreview && index <= activeValue ? 'opacity-75' : '',
        ]"
      />
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import * as icons from "lucide-vue-next";
import type { BooleanIcon } from "../../types/models";

const props = withDefaults(
  defineProps<{
    modelValue: number | null;
    icon?: BooleanIcon;
    color?: string;
    valueColors?: Record<string, string>;
    max?: number;
    size?: number;
    filledClass?: string;
    emptyClass?: string;
  }>(),
  {
    icon: "star",
    color: "currentColor",
    max: 5,
    size: 18,
    filledClass: "text-primary",
    emptyClass: "text-(--text-muted)",
  },
);

const emit = defineEmits<{
  (e: "update:modelValue", value: number | null): void;
}>();

const hoverValue = ref<number | null>(null);

const iconMap: Record<BooleanIcon, typeof icons.Square> = {
  square: icons.Square,
  circle: icons.Circle,
  heart: icons.Heart,
  star: icons.Star,
  flame: icons.Flame,
  "thumbs-up": icons.ThumbsUp,
  "thumbs-down": icons.ThumbsDown,
  flag: icons.Flag,
};

const safeMax = computed(() => Math.max(1, Number(props.max) || 5));
const activeValue = computed(() => hoverValue.value ?? props.modelValue ?? 0);
const isHoverPreview = computed(() => hoverValue.value !== null);
const iconComponent = computed(() => iconMap[props.icon ?? "star"]);
const colorValue = computed(() => {
  const key = String(activeValue.value);
  const optionColor = props.valueColors?.[key];
  return optionColor && optionColor.trim().length > 0
    ? optionColor
    : (props.color ?? "currentColor");
});

function commitValue(nextValue: number) {
  emit("update:modelValue", props.modelValue === nextValue ? null : nextValue);
}
</script>

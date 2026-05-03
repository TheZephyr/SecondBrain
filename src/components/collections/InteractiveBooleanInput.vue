<template>
  <button
    type="button"
    class="flex items-center transition-colors"
    :class="[
      isHoverPreview ? 'opacity-75' : '',
      disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer',
    ]"
    @mouseenter="onMouseEnter"
    @mouseleave="onMouseLeave"
    @click.stop="toggle"
  >
    <component
      :is="iconComponent"
      :size="size"
      :fill="activeValue ? colorValue : 'transparent'"
      :stroke-width="activeValue ? 0 : 1.5"
      :class="[
        activeValue ? filledClass : emptyClass,
      ]"
      :style="activeValue ? { color: colorValue } : {}"
    />
  </button>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import * as icons from "lucide-vue-next";
import type { BooleanIcon } from "../../types/models";

const props = withDefaults(
  defineProps<{
    modelValue: boolean;
    icon?: BooleanIcon;
    color?: string;
    size?: number;
    filledClass?: string;
    emptyClass?: string;
    disabled?: boolean;
  }>(),
  {
    icon: "square",
    color: "currentColor",
    size: 18,
    filledClass: "text-primary",
    emptyClass: "text-(--text-muted)",
    disabled: false,
  },
);

const emit = defineEmits<{
  (e: "update:modelValue", value: boolean): void;
}>();

const hoverValue = ref<boolean | null>(null);

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

const activeValue = computed(() =>
  hoverValue.value !== null ? hoverValue.value : props.modelValue,
);
const isHoverPreview = computed(() => hoverValue.value !== null);
const iconComponent = computed(() => iconMap[props.icon ?? "square"]);
const colorValue = computed(() =>
  props.color && props.color.trim().length > 0 ? props.color : "currentColor",
);

function onMouseEnter() {
  if (props.disabled) return;
  hoverValue.value = !props.modelValue;
}

function onMouseLeave() {
  hoverValue.value = null;
}

function toggle() {
  if (props.disabled) return;
  emit("update:modelValue", !props.modelValue);
}
</script>

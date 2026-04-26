<template>
  <Transition
    enter-active-class="transition duration-150 ease-out"
    enter-from-class="opacity-0 translate-y-1"
    enter-to-class="opacity-100 translate-y-0"
    leave-active-class="transition duration-100 ease-in"
    leave-from-class="opacity-100 translate-y-0"
    leave-to-class="opacity-0 translate-y-1"
  >
    <div
      v-if="open"
      :id="id"
      class="absolute z-50 overflow-hidden rounded-lg border border-(--border-color) bg-(--bg-primary) shadow-lg"
      :class="placementClass"
      role="menu"
      @keydown.esc.prevent="emit('close')"
    >
      <div class="divide-y divide-(--border-color)/70">
        <button
          v-for="viewType in viewTypes"
          :key="viewType.type"
          type="button"
          class="group flex h-10 w-full items-center gap-3 px-3 text-base text-(--text-secondary) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--accent-primary)"
          :class="
            viewType.disabled
              ? 'cursor-not-allowed opacity-60'
              : 'hover:bg-(--bg-hover) hover:text-(--text-primary)'
          "
          :disabled="viewType.disabled"
          :title="viewType.tooltip"
          role="menuitem"
          @click="viewType.disabled ? undefined : emit('select', viewType.type)"
        >
          <component
            :is="viewType.icon"
            class="size-4 text-(--accent-primary)"
          />
          <span class="flex-1 text-left">{{ viewType.label }}</span>
          <Plus
            class="size-4 text-(--accent-primary) opacity-70 transition-opacity group-hover:opacity-100"
          />
        </button>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { computed, type Component } from "vue";
import { Plus } from "lucide-vue-next";
import type { ViewType } from "../../../types/models";

const props = defineProps<{
  id?: string;
  open: boolean;
  placement: "top" | "bottom";
  viewTypes: Array<{
    type: ViewType;
    label: string;
    icon: Component;
    disabled?: boolean;
    tooltip?: string;
  }>;
}>();

const emit = defineEmits<{
  (e: "select", viewType: ViewType): void;
  (e: "close"): void;
}>();

const placementClass = computed(() =>
  props.placement === "top"
    ? "bottom-full mb-2 left-0 right-0"
    : "top-full mt-2 left-0 right-0",
);
</script>

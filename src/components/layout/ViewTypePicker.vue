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
      class="absolute z-50 overflow-hidden rounded-lg border border-[var(--border-color)] bg-[var(--bg-primary)] shadow-lg"
      :class="placementClass"
      role="menu"
      @keydown.esc.prevent="emit('close')"
    >
      <div class="divide-y divide-[var(--border-color)]/70">
        <button
          v-for="viewType in viewTypes"
          :key="viewType.type"
          type="button"
          class="group flex h-10 w-full items-center gap-3 px-3 text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)]"
          role="menuitem"
          @click="emit('select', viewType.type)"
        >
          <i class="pi text-sm" :class="[viewType.icon, viewType.iconClass]"></i>
          <span class="flex-1 text-left">{{ viewType.label }}</span>
          <i
            class="pi pi-plus text-xs text-[var(--accent-primary)] opacity-70 transition-opacity group-hover:opacity-100"
          ></i>
        </button>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { ViewType } from "../../types/models";

const props = defineProps<{
  id?: string;
  open: boolean;
  placement: "top" | "bottom";
  viewTypes: Array<{
    type: ViewType;
    label: string;
    icon: string;
    iconClass: string;
  }>;
}>();

const emit = defineEmits<{
  (e: "select", viewType: ViewType): void;
  (e: "close"): void;
}>();

const placementClass = computed(() =>
  props.placement === "top" ? "bottom-full mb-2 left-0 right-0" : "top-full mt-2 left-0 right-0",
);
</script>

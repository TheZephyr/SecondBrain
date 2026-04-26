<template>
  <span
    v-if="descriptionText"
    class="inline-flex size-4 items-center justify-center rounded-full border border-(--border-color) text-[10px] text-(--text-muted)"
    :title="descriptionText"
    aria-label="Field description"
  >
    i
  </span>
</template>

<script setup lang="ts">
import { computed } from "vue";

const props = defineProps<{
  description?: string | null;
}>();

const descriptionText = computed(() => {
  if (typeof props.description !== "string") {
    return "";
  }

  const trimmed = props.description.trim();
  return trimmed.length > 0 ? trimmed : "";
});
</script>

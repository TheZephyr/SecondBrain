<template>
  <Tooltip v-if="descriptionText" :delay-duration="300">
    <TooltipTrigger as-child>
      <span
        class="inline-flex size-4 items-center justify-center rounded-full border border-(--border-color) text-[10px] text-(--text-muted) cursor-help"
        aria-label="Field description"
      >
        i
      </span>
    </TooltipTrigger>
    <TooltipContent side="top" class="max-w-xs">
      {{ descriptionText }}
    </TooltipContent>
  </Tooltip>
</template>

<script setup lang="ts">
import { computed } from "vue";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

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

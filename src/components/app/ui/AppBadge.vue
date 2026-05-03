<template>
  <Badge :variant="variant" :class="class">
    <slot>
      {{ value ?? label }}
    </slot>
  </Badge>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { HTMLAttributes } from "vue";
import { Badge } from "@/components/ui/badge";

const props = defineProps<{
  value?: string;
  label?: string;
  severity?: "secondary" | "info" | "success" | "warn" | "danger";
  class?: HTMLAttributes["class"];
}>();

const variant = computed(() => {
  switch (props.severity) {
    case "secondary":
    case "info":
      return "secondary";
    case "success":
      return "default";
    case "warn":
      return "outline";
    case "danger":
      return "destructive";
    default:
      return "secondary";
  }
});
</script>

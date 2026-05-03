<template>
  <Textarea
    :id="id"
    :model-value="modelValue"
    :rows="rows"
    :placeholder="placeholder"
    :disabled="disabled"
    :class="class"
    @update:model-value="$emit('update:modelValue', String($event ?? ''))"
  />
</template>

<script setup lang="ts">
import type { HTMLAttributes } from "vue";
import { Textarea } from "@/components/ui/textarea";

defineProps<{
  modelValue?: string;
  id?: string;
  rows?: number;
  placeholder?: string;
  disabled?: boolean;
  class?: HTMLAttributes["class"];
  autoResize?: boolean;
}>();

defineEmits<{
  (e: "update:modelValue", value: string): void;
}>();
</script>

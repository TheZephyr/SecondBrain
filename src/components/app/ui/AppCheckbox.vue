<template>
  <Checkbox
    :id="inputId"
    :model-value="modelValue"
    :disabled="disabled"
    @update:model-value="$emit('update:modelValue', Boolean($event))"
  />
</template>

<script setup lang="ts">
import { Checkbox } from "@/components/ui/checkbox";

defineProps<{
  modelValue?: boolean;
  inputId?: string;
  disabled?: boolean;
  binary?: boolean;
}>();

defineEmits<{
  (e: "update:modelValue", value: boolean): void;
}>();
</script>

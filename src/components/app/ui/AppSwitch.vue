<template>
  <Switch
    :id="inputId"
    :model-value="modelValue"
    :disabled="disabled"
    @update:model-value="$emit('update:modelValue', Boolean($event))"
  />
</template>

<script setup lang="ts">
import { Switch } from "@/components/ui/switch";

defineProps<{
  modelValue?: boolean;
  inputId?: string;
  disabled?: boolean;
}>();

defineEmits<{
  (e: "update:modelValue", value: boolean): void;
}>();
</script>

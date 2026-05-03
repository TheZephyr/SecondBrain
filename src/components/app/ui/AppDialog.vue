<template>
  <Dialog :open="visible" @update:open="onOpenChange">
    <DialogContent :class="contentClass">
      <DialogHeader v-if="$slots.header || header">
        <slot name="header">
          <DialogTitle>{{ header }}</DialogTitle>
        </slot>
      </DialogHeader>
      <slot />
      <DialogFooter v-if="$slots.footer">
        <slot name="footer" />
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { HTMLAttributes } from "vue";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

const props = defineProps<{
  visible: boolean;
  header?: string;
  class?: HTMLAttributes["class"];
}>();

const emit = defineEmits<{
  (e: "update:visible", value: boolean): void;
  (e: "hide"): void;
}>();

const contentClass = computed(() => cn("sm:max-w-xl", props.class));

function onOpenChange(nextOpen: boolean) {
  emit("update:visible", nextOpen);
  if (!nextOpen) {
    emit("hide");
  }
}
</script>

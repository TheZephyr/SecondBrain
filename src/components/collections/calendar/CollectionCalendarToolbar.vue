<template>
  <div class="flex flex-wrap items-center gap-3 border-b border-[var(--border-color)] bg-[var(--bg-secondary)] px-3 py-2">
    <div class="flex items-center gap-2">
      <AppButton
        text
        class="h-8 w-8 rounded-md text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
        @click="emit('previous-month')"
      >
        <template #icon>
          <ChevronLeft class="size-4" />
        </template>
      </AppButton>
      <div class="min-w-40 text-base font-semibold text-[var(--text-primary)]">
        {{ monthLabel }}
      </div>
      <AppButton
        text
        class="h-8 w-8 rounded-md text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
        @click="emit('next-month')"
      >
        <template #icon>
          <ChevronRight class="size-4" />
        </template>
      </AppButton>
    </div>

    <div class="flex-1" />

    <div v-if="showLoadingState" class="text-base text-[var(--text-muted)]">
      Loading all items...
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { ChevronLeft, ChevronRight } from "lucide-vue-next";
import AppButton from "@/components/app/ui/AppButton.vue";

const props = defineProps<{
  monthLabel: string;
  isLoadingAll: boolean;
}>();

const emit = defineEmits<{
  (e: "previous-month"): void;
  (e: "next-month"): void;
}>();

const showLoadingState = computed(() => props.isLoadingAll);
</script>

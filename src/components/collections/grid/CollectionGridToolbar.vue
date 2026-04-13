<template>
  <div class="flex h-10 items-center border-b border-[var(--border-color)] bg-[var(--bg-secondary)] px-2 py-5">
    <div class="flex items-center gap-1">
      <AppButton
        text
        class="h-7 gap-1.5 rounded-md px-2 text-base text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
      >
        <template #icon>
          <Filter class="size-4" />
        </template>
        <span>Filter</span>
      </AppButton>
      <AppButton text class="h-7 gap-1.5 rounded-md px-2 text-base" :class="sortButtonClass">
        <template #icon>
          <ArrowUpDown class="size-4" />
        </template>
        <span>Sort</span>
      </AppButton>
    </div>

    <div class="flex-1" />

    <div class="relative">
      <Search :size="16" class="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
      <AppInput v-model="searchModel" class="h-7 w-40 pl-8 text-base md:w-52" type="text" placeholder="Search..." />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { ArrowUpDown, Filter, Search } from "lucide-vue-next";
import AppButton from "@/components/app/ui/AppButton.vue";
import AppInput from "@/components/app/ui/AppInput.vue";
import type { MultiSortMeta } from "../types";

const props = defineProps<{
  multiSortMeta: MultiSortMeta[];
  searchQuery: string;
}>();

const emit = defineEmits<{
  (e: "update:searchQuery", value: string): void;
}>();

const searchModel = computed({
  get: () => props.searchQuery,
  set: (value: string) => emit("update:searchQuery", value),
});

const sortButtonClass = computed(() => {
  if (props.multiSortMeta.length > 0) {
    return "bg-[var(--accent-light)] text-[var(--accent-primary)]";
  }

  return "text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]";
});
</script>

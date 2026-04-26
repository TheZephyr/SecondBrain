<template>
  <div
    class="sticky bottom-0 z-10 flex shrink-0 items-center border-t border-(--border-color) bg-(--bg-secondary) px-3 py-2 text-base text-(--text-muted)"
  >
    <span>{{ itemsTotal }} rows</span>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  itemsTotal: number;
}>();
</script>

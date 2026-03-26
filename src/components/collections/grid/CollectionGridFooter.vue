<template>
  <div
    class="sticky bottom-0 z-10 flex shrink-0 items-center border-t border-[var(--border-color)] bg-[var(--bg-secondary)] px-3 py-2 text-base text-[var(--text-muted)]">
    <span>{{ itemsTotal }} rows</span>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  itemsTotal: number
}>()
</script>

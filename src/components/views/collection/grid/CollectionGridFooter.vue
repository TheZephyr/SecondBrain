<template>
  <div
    class="flex items-center border-t border-[var(--border-color)] bg-[var(--bg-secondary)] px-3 py-2 text-xs text-[var(--text-muted)]"
  >
    <span>{{ itemsTotal }} rows</span>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  itemsTotal: number
}>()
</script>

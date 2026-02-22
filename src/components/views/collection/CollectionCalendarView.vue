<template>
  <div class="flex items-center justify-center py-32 text-[var(--text-muted)]">
    <p class="text-sm">Calendar view — coming soon</p>
  </div>
</template>

<script setup lang="ts">
import type { Field } from '../../../types/models'

defineProps<{
  orderedFields: Field[]
}>()
</script>

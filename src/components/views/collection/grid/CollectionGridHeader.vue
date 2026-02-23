<template>
  <div
    class="grid h-9 items-center border-b border-[var(--border-color)] bg-[var(--bg-secondary)] text-xs"
    :style="{ gridTemplateColumns }"
  >
    <div
      v-for="(header, index) in headers"
      :key="header.id"
      class="flex h-9 items-center border-r border-[var(--border-color)]"
      :class="index === headers.length - 1 ? 'border-r-0' : ''"
    >
      <template v-if="headerMeta(header)?.type === 'rowNumber'">
        <span class="sr-only">Row</span>
      </template>
      <template v-else-if="headerMeta(header)?.type === 'addField'">
        <Button
          text
          class="mx-auto h-8 w-8 p-0"
          title="Add field"
          @click.stop="$emit('manage-fields')"
        >
          <Plus :size="14" />
        </Button>
      </template>
      <template v-else>
        <button
          type="button"
          class="flex h-full w-full items-center justify-between gap-2 px-3 text-left text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
          @click="event => toggleSort(headerMeta(header)?.field, event)"
        >
          <span class="truncate">{{ headerMeta(header)?.field?.name ?? header.id }}</span>
          <span
            v-if="getSortEntry(headerMeta(header)?.field)"
            class="flex items-center gap-1 text-[var(--text-muted)]"
          >
            <ChevronUp
              v-if="getSortEntry(headerMeta(header)?.field)?.order === 1"
              :size="12"
            />
            <ChevronDown
              v-else-if="getSortEntry(headerMeta(header)?.field)?.order === -1"
              :size="12"
            />
            <span
              v-if="multiSortMeta.length > 1"
              class="text-[10px]"
            >
              {{ getSortIndex(headerMeta(header)?.field) + 1 }}
            </span>
          </span>
        </button>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { Header, HeaderGroup } from '@tanstack/vue-table'
import { ChevronDown, ChevronUp, Plus } from 'lucide-vue-next'
import Button from 'primevue/button'
import type { Field } from '../../../../types/models'
import type { MultiSortMeta } from '../types'
import type { GridRow, GridColumnMeta } from './types'

const props = defineProps<{
  headerGroups: HeaderGroup<GridRow>[]
  gridTemplateColumns: string
  multiSortMeta: MultiSortMeta[]
}>()

const emit = defineEmits<{
  sort: [value: MultiSortMeta[]]
  'manage-fields': []
}>()

const headers = computed(() => props.headerGroups[0]?.headers ?? [])

function headerMeta(header: Header<GridRow, unknown>): GridColumnMeta | undefined {
  return header.column.columnDef.meta as GridColumnMeta | undefined
}

function getFieldKey(field: Field) {
  return `data.${field.name}`
}

function getSortEntry(field?: Field) {
  if (!field) return null
  return props.multiSortMeta.find(entry => entry.field === getFieldKey(field)) ?? null
}

function getSortIndex(field?: Field) {
  if (!field) return -1
  return props.multiSortMeta.findIndex(entry => entry.field === getFieldKey(field))
}

function toggleSort(field: Field | undefined, event: MouseEvent) {
  if (!field) return
  const fieldKey = getFieldKey(field)
  const current = props.multiSortMeta
  const index = current.findIndex(entry => entry.field === fieldKey)
  const isShift = event.shiftKey

  if (!isShift) {
    if (index === -1) {
      emit('sort', [{ field: fieldKey, order: 1 }])
      return
    }
    const nextOrder = current[index]?.order === 1 ? -1 : null
    if (nextOrder === null) {
      emit('sort', [])
      return
    }
    emit('sort', [{ field: fieldKey, order: nextOrder }])
    return
  }

  if (index === -1) {
    emit('sort', [...current, { field: fieldKey, order: 1 }])
    return
  }

  const currentOrder = current[index]?.order
  if (currentOrder === 1) {
    const next = [...current]
    next[index] = { field: fieldKey, order: -1 }
    emit('sort', next)
    return
  }

  emit('sort', current.filter(entry => entry.field !== fieldKey))
}
</script>

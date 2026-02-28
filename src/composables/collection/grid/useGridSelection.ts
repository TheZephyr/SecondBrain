import { onBeforeUnmount, onMounted, ref } from 'vue'
import type { GridCellKey } from '../../../components/views/collection/grid/types'

const CELL_KEY_SEPARATOR = '::'

export function buildGridCellKey(rowId: number, fieldName: string): GridCellKey {
  return `${rowId}${CELL_KEY_SEPARATOR}${fieldName}` as GridCellKey
}

export function parseGridCellKey(key: GridCellKey | null) {
  if (!key) return null
  const [rowIdPart, fieldName] = key.split(CELL_KEY_SEPARATOR)
  const rowId = Number(rowIdPart)
  if (!Number.isFinite(rowId) || !fieldName) return null
  return { rowId, fieldName }
}

export function useGridSelection() {
  const selectedCellKey = ref<GridCellKey | null>(null)

  function selectCell(rowId: number, fieldName: string) {
    selectedCellKey.value = buildGridCellKey(rowId, fieldName)
  }

  function clearSelection() {
    selectedCellKey.value = null
  }

  function isSelected(rowId: number, fieldName: string) {
    return selectedCellKey.value === buildGridCellKey(rowId, fieldName)
  }

  function handleDocumentMouseDown(event: MouseEvent) {
    const target = event.target as HTMLElement | null
    if (!target) return
    if (target.closest('[data-grid-cell]')) return
    clearSelection()
  }

  onMounted(() => {
    document.addEventListener('mousedown', handleDocumentMouseDown)
  })

  onBeforeUnmount(() => {
    document.removeEventListener('mousedown', handleDocumentMouseDown)
  })

  return {
    selectedCellKey,
    selectCell,
    clearSelection,
    isSelected
  }
}

import type { ColumnDef } from '@tanstack/vue-table'
import type { InjectionKey, Ref } from 'vue'
import type { Field, Item, ItemDataValue } from '../../../../types/models'

export type GridRow = Item

export type GridColumnMeta = {
  type: 'rowNumber' | 'field' | 'addField'
  field?: Field
}

export type GridColumnDef = ColumnDef<GridRow, unknown> & {
  meta?: GridColumnMeta
}

export type GridCellKey = `${number}::${string}`

export type GridSelectionContext = {
  selectedCellKey: Ref<GridCellKey | null>
  selectCell: (rowId: number, fieldName: string) => void
  clearSelection: () => void
  isSelected: (rowId: number, fieldName: string) => boolean
}

export type GridEditingContext = {
  editingCellKey: Ref<GridCellKey | null>
  startEdit: (rowId: number, fieldName: string) => void
  commitEdit: (value: ItemDataValue | Date | null | undefined) => Promise<void> | void
  cancelEdit: () => void
}

export const gridSelectionKey: InjectionKey<GridSelectionContext> = Symbol('gridSelection')
export const gridEditingKey: InjectionKey<GridEditingContext> = Symbol('gridEditing')

import type { ColumnDef } from '@tanstack/vue-table'
import type { Field, Item } from '../../../../types/models'

export type GridRow = Item

export type GridColumnMeta = {
  type: 'rowNumber' | 'field' | 'addField'
  field?: Field
}

export type GridColumnDef = ColumnDef<GridRow, unknown> & {
  meta?: GridColumnMeta
}

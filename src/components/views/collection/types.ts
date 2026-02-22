import type { FieldType, ItemData } from '../../../types/models'

export type RawSortMeta = { field?: string; order?: 1 | -1 | 0 | null }

export type MultiSortMeta = { field: string; order: 1 | -1 }

export type FieldDraftInput = {
  name: string
  type: FieldType
  options: string
}

export type ItemEditorSavePayload = {
  data: ItemData
  editingItemId: number | null
}

export type CollectionSettingsSavePayload = {
  name: string
}

export type TablePageEventLike = {
  first: number
  rows?: number
}

export type TableSortEventLike = {
  multiSortMeta?: RawSortMeta[] | null
}

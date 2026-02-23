import { computed, type Ref } from 'vue'
import type { Field, Item } from '../../../types/models'
import type { GridColumnDef } from '../../../components/views/collection/grid/types'

type UseGridColumnsParams = {
  orderedFields: Ref<Field[]>
}

export function useGridColumns({ orderedFields }: UseGridColumnsParams) {
  return computed<GridColumnDef[]>(() => {
    const fieldColumns: GridColumnDef[] = orderedFields.value.map(field => ({
      id: `field_${field.id}`,
      header: field.name,
      accessorFn: (row: Item) => row.data[field.name],
      meta: {
        type: 'field',
        field
      }
    }))

    return [
      {
        id: 'rowNumber',
        header: '',
        cell: () => null,
        meta: {
          type: 'rowNumber'
        }
      },
      ...fieldColumns,
      {
        id: 'addField',
        header: '',
        cell: () => null,
        meta: {
          type: 'addField'
        }
      }
    ]
  })
}

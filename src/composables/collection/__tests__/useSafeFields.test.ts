import { describe, expect, it, vi } from 'vitest'
import { nextTick, ref } from 'vue'
import type { Field } from '../../../types/models'
import { useSafeFields } from '../useSafeFields'

function makeField(input: Partial<Field> & Pick<Field, 'id' | 'name'>): Field {
  return {
    id: input.id,
    collection_id: 1,
    name: input.name,
    type: input.type ?? 'text',
    options: input.options ?? null,
    order_index: input.order_index ?? 0
  }
}

describe('useSafeFields', () => {
  it('filters unsafe fields and keeps order by order_index', async () => {
    const fields = ref<Field[]>([
      makeField({ id: 1, name: 'Title', order_index: 2 }),
      makeField({ id: 2, name: 'bad.name', order_index: 0 }),
      makeField({ id: 3, name: 'Author', order_index: 1 })
    ])
    const notifications = { push: vi.fn() }

    const { safeFields, orderedFields } = useSafeFields({
      fields,
      notifications
    })

    await nextTick()

    expect(safeFields.value.map(field => field.name)).toEqual(['Title', 'Author'])
    expect(orderedFields.value.map(field => field.name)).toEqual(['Author', 'Title'])
  })

  it('warns once per unsafe field id', async () => {
    const fields = ref<Field[]>([
      makeField({ id: 1, name: 'Title' }),
      makeField({ id: 2, name: 'bad.name' })
    ])
    const notifications = { push: vi.fn() }

    useSafeFields({ fields, notifications })
    await nextTick()
    expect(notifications.push).toHaveBeenCalledTimes(1)

    fields.value = [
      makeField({ id: 1, name: 'Title' }),
      makeField({ id: 2, name: 'bad.name' })
    ]
    await nextTick()

    expect(notifications.push).toHaveBeenCalledTimes(1)
  })
})

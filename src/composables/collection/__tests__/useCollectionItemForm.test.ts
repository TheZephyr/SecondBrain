import { describe, expect, it } from 'vitest'
import { ref } from 'vue'
import type { Field, Item } from '../../../types/models'
import {
  buildItemDataFromForm,
  buildItemFormDataFromItem,
  createDefaultItemFormData,
  useCollectionItemForm
} from '../useCollectionItemForm'

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

describe('useCollectionItemForm', () => {
  it('creates default form data by field type', () => {
    const fields: Field[] = [
      makeField({ id: 1, name: 'Title', type: 'text' }),
      makeField({ id: 2, name: 'Published', type: 'date' }),
      makeField({ id: 3, name: 'Rating', type: 'number' })
    ]

    const form = createDefaultItemFormData(fields)
    expect(form.Title).toBe('')
    expect(form.Published).toBeNull()
    expect(form.Rating).toBe('')
  })

  it('maps item data to form data and back with date conversion', () => {
    const fields: Field[] = [
      makeField({ id: 1, name: 'Title', type: 'text' }),
      makeField({ id: 2, name: 'Published', type: 'date' }),
      makeField({ id: 3, name: 'Rating', type: 'number' }),
      makeField({ id: 4, name: 'Status', type: 'select' })
    ]

    const item: Item = {
      id: 42,
      collection_id: 1,
      data: {
        Title: 'Dune',
        Published: '2025-01-15',
        Rating: 9,
        Status: 'Read'
      }
    }

    const formData = buildItemFormDataFromItem(item, fields)
    const published = formData.Published
    expect(published instanceof Date).toBe(true)
    if (published instanceof Date) {
      expect(published.getFullYear()).toBe(2025)
      expect(published.getMonth()).toBe(0)
      expect(published.getDate()).toBe(15)
    }

    formData.Published = new Date(2026, 1, 5)
    const serialized = buildItemDataFromForm(formData, fields)
    expect(serialized).toEqual({
      Title: 'Dune',
      Published: '2026-02-05',
      Rating: 9,
      Status: 'Read'
    })
  })

  it('supports create/edit flows through the composable API', () => {
    const fields = ref<Field[]>([
      makeField({ id: 1, name: 'Title', type: 'text' }),
      makeField({ id: 2, name: 'Published', type: 'date' })
    ])

    const item: Item = {
      id: 7,
      collection_id: 1,
      data: {
        Title: 'Neuromancer',
        Published: '2024-08-11'
      }
    }

    const form = useCollectionItemForm(fields)

    form.startEdit(item)
    expect(form.isEditing.value).toBe(true)
    expect(form.getTextValue('Title')).toBe('Neuromancer')
    expect(form.getDateValue('Published') instanceof Date).toBe(true)

    form.startCreate()
    expect(form.isEditing.value).toBe(false)
    expect(form.getTextValue('Title')).toBe('')
    expect(form.getDateValue('Published')).toBeNull()
  })
})

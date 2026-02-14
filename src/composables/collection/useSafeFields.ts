import { computed, watch, type Ref } from 'vue'
import { useNotificationsStore, type ToastMessage } from '../../stores/notifications'
import type { Field } from '../../types/models'
import { isSafeFieldName } from '../../validation/fieldNames'

type NotificationsLike = {
  push: (message: ToastMessage) => void
}

type UseSafeFieldsParams = {
  fields: Ref<Field[]>
  notifications?: NotificationsLike
}

export function useSafeFields({ fields, notifications }: UseSafeFieldsParams) {
  const notificationsStore = notifications ?? useNotificationsStore()
  const warnedUnsafeFields = new Set<number>()

  const safeFields = computed(() => {
    return fields.value.filter(field => isSafeFieldName(field.name))
  })

  const orderedFields = computed(() => {
    return [...safeFields.value].sort((a, b) => a.order_index - b.order_index)
  })

  watch(
    () => fields.value,
    nextFields => {
      const unsafeFields = nextFields.filter(field => !isSafeFieldName(field.name))
      if (unsafeFields.length === 0) return

      for (const field of unsafeFields) {
        if (warnedUnsafeFields.has(field.id)) continue
        warnedUnsafeFields.add(field.id)
        notificationsStore.push({
          severity: 'warn',
          summary: 'Unsafe field hidden',
          detail: `Field "${field.name}" is not supported and has been hidden.`,
          life: 7000
        })
      }
    },
    { immediate: true }
  )

  return {
    safeFields,
    orderedFields
  }
}

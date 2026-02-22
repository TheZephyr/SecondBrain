<template>
  <Dialog :visible="visible" header="Collection Settings" modal :draggable="false" class="w-full max-w-4xl"
    @update:visible="onVisibilityChange" @hide="cancelSettings">
    <Accordion value="0">
      <AccordionPanel value="0">
        <AccordionHeader>
          <div class="flex items-center gap-2">
            <Settings2 :size="16" />
            <span>Collection Settings</span>
          </div>
        </AccordionHeader>
        <AccordionContent>
          <div class="space-y-4">
            <div class="space-y-2">
              <label class="text-xs font-medium text-[var(--text-secondary)]">Collection Name </label>
              <InputText v-model="collectionName" type="text" placeholder="Collection name" />
            </div>
          </div>
        </AccordionContent>
      </AccordionPanel>

      <AccordionPanel value="1">
        <AccordionHeader>
          <div class="flex items-center gap-2">
            <Upload :size="16" />
            <span>Export Data</span>
          </div>
        </AccordionHeader>
        <AccordionContent>
          <div class="space-y-4">
            <div class="space-y-2">
              <label class="text-xs font-medium text-[var(--text-secondary)]">Export Format</label>
              <Select v-model="exportFormat" :options="exportFormatOptions" optionLabel="label" optionValue="value" />
            </div>
            <div class="rounded-md border border-[var(--border-color)] bg-[var(--bg-tertiary)] p-3 text-xs text-[var(--text-secondary)]">
              <p v-if="exportFormat === 'csv'">
                Export all items as a CSV file. All values will be enclosed in quotes for compatibility.
              </p>
              <p v-else>
                Export all items as a JSON file. Data will be exported as an array of objects with full type
                preservation.
              </p>
            </div>
            <Button class="w-full justify-center gap-2" :disabled="isExporting" @click="handleExport">
              <Download v-if="!isExporting" />
              <span v-if="isExporting">Exporting...</span>
              <span v-else>Export {{ itemsTotal }} {{ itemsTotal === 1 ? 'item' : 'items' }}</span>
            </Button>
          </div>
        </AccordionContent>
      </AccordionPanel>

      <AccordionPanel value="2">
        <AccordionHeader>
          <div class="flex items-center gap-2">
            <Download :size="16" />
            <span>Import Data</span>
          </div>
        </AccordionHeader>
        <AccordionContent>
          <div class="space-y-4">
            <div v-if="!importPreview" class="space-y-4">
              <div class="space-y-2">
                <label class="text-xs font-medium text-[var(--text-secondary)]">Import Format</label>
                <Select v-model="importFormat" :options="exportFormatOptions" optionLabel="label" optionValue="value" />
              </div>

              <div class="space-y-2">
                <label class="text-xs font-medium text-[var(--text-secondary)]">Import Mode</label>
                <div class="flex gap-2">
                  <label
                    class="flex flex-1 items-start gap-3 rounded-md border border-[var(--border-color)] bg-[var(--bg-tertiary)] p-3 text-sm text-[var(--text-secondary)]">
                    <RadioButton v-model="importMode" value="append" />
                    <div>
                      <div class="font-medium text-[var(--text-primary)]">Append</div>
                      <div class="text-xs text-[var(--text-muted)]">Add imported items to existing data</div>
                    </div>
                  </label>
                  <label
                    class="flex flex-1 items-start gap-3 rounded-md border border-[var(--border-color)] bg-[var(--bg-tertiary)] p-3 text-sm text-[var(--text-secondary)]">
                    <RadioButton v-model="importMode" value="replace" />
                    <div>
                      <div class="font-medium text-[var(--text-primary)]">Replace</div>
                      <div class="text-xs text-[var(--text-muted)]">Delete all existing items and import new data</div>
                    </div>
                  </label>
                </div>
              </div>

              <Button class="w-full justify-center gap-2" @click="handleSelectFile">
                <Download />
                Select File to Import
              </Button>
            </div>

            <div v-else class="space-y-4">
              <div class="flex items-center justify-between border-b border-[var(--border-color)] pb-3">
                <div class="flex items-center gap-2 font-semibold text-[var(--text-primary)]">
                  <FileText :size="18" />
                  Import Preview
                </div>
                <Button text class="h-8 w-8 p-0" title="Cancel" @click="cancelImport">
                  <X />
                </Button>
              </div>

              <div class="rounded-md border border-[var(--border-color)] bg-[var(--bg-tertiary)] p-3 text-xs">
                <div class="flex justify-between text-[var(--text-secondary)]">
                  <span>Items to import:</span>
                  <span class="font-semibold text-[var(--text-primary)]">{{ importPreview.itemCount }}</span>
                </div>
                <div class="mt-2 flex justify-between text-[var(--text-secondary)]">
                  <span>Import mode:</span>
                  <span class="font-semibold text-[var(--text-primary)]">{{ importMode === 'append' ? 'Append' : 'Replace' }}</span>
                </div>
              </div>

              <div v-if="safeFields.length === 0"
                class="flex items-start gap-2 rounded-md border border-[color-mix(in_srgb,var(--accent-primary)_30%,transparent)] bg-[var(--accent-light)] p-3 text-xs text-[var(--text-secondary)]">
                <AlertTriangle :size="16" />
                This collection has no fields. Fields will be automatically created from the import file.
              </div>

              <div v-if="importPreview.matchedFields.length > 0" class="space-y-2">
                <div class="text-xs font-semibold text-[var(--text-primary)]">
                  Matched Fields ({{ importPreview.matchedFields.length }})
                </div>
                <div class="flex flex-wrap gap-2">
                  <Tag v-for="field in importPreview.matchedFields" :key="field"
                    class="bg-[color-mix(in_srgb,var(--success)_20%,transparent)] text-[var(--success)]">
                    {{ field }}
                  </Tag>
                </div>
              </div>

              <div v-if="importPreview.newFields.length > 0" class="space-y-2">
                <div class="flex items-center gap-2 text-xs font-semibold text-[var(--text-primary)]">
                  <AlertTriangle :size="14" />
                  New Fields ({{ importPreview.newFields.length }})
                </div>
                <p class="text-xs text-[var(--text-muted)]">These fields will be added to your collection:</p>
                <div class="flex flex-wrap gap-2">
                  <Tag v-for="field in importPreview.newFields" :key="field"
                    class="bg-[color-mix(in_srgb,var(--warning)_20%,transparent)] text-[var(--warning)]">
                    {{ field }}
                  </Tag>
                </div>
              </div>

              <div class="rounded-md border border-[var(--border-color)] bg-[var(--bg-tertiary)] p-3 text-xs">
                <div class="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                  Sample Data (first 3 items)
                </div>
                <div class="flex gap-2">
                  <div v-for="(item, index) in importPreview.sample" :key="index"
                    class="flex-1 rounded border border-[var(--border-color)] bg-[var(--bg-primary)] p-2">
                    <div class="mb-1 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                      Item {{ index + 1 }}
                    </div>
                    <div class="space-y-1">
                      <div v-for="(value, key) in item" :key="key" class="flex gap-2">
                        <span class="min-w-[80px] text-[var(--text-muted)]">{{ key }}:</span>
                        <span class="text-[var(--text-primary)]">{{ value || '(empty)' }}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div class="flex items-center justify-end gap-2 border-t border-[var(--border-color)] pt-4">
                <Button severity="secondary" text @click="cancelImport">Cancel</Button>
                <Button class="gap-2" :disabled="isImporting" @click="handleImport">
                  <Upload v-if="!isImporting" :size="16" />
                  <span v-if="isImporting">Importing...</span>
                  <span v-else>Import {{ importPreview.itemCount }} items</span>
                </Button>
              </div>
            </div>
          </div>
        </AccordionContent>
      </AccordionPanel>

      <AccordionPanel value="3">
        <AccordionHeader>
          <div class="flex items-center gap-2">
            <AlertTriangle :size="16" />
            <span>Danger Zone</span>
          </div>
        </AccordionHeader>
        <AccordionContent>
          <div class="space-y-3">
            <p class="text-xs text-[var(--text-muted)]">
              Once you delete a collection, there is no going back.
            </p>
            <Button severity="danger" class="gap-2 min-w-[180px]" @click="$emit('delete-collection')">
              <Trash2 />
              Delete Collection
            </Button>
          </div>
        </AccordionContent>
      </AccordionPanel>
    </Accordion>

    <template #footer>
      <Button severity="secondary" text @click="cancelSettings">Cancel</Button>
      <Button @click="saveSettings">Save Changes</Button>
    </template>
  </Dialog>
</template>

<script setup lang="ts">
import { computed, ref, toRef, watch } from 'vue'
import {
  AlertTriangle,
  Download,
  FileText,
  Settings2,
  Trash2,
  Upload,
  X
} from 'lucide-vue-next'
import Accordion from 'primevue/accordion'
import AccordionContent from 'primevue/accordioncontent'
import AccordionHeader from 'primevue/accordionheader'
import AccordionPanel from 'primevue/accordionpanel'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import RadioButton from 'primevue/radiobutton'
import Select from 'primevue/select'
import Tag from 'primevue/tag'
import type { Collection, Field } from '../../../types/models'
import { useCollectionImportExport } from '../../../composables/useCollectionImportExport'
import { isSafeFieldName } from '../../../validation/fieldNames'
import type { CollectionSettingsSavePayload } from './types'

const props = defineProps<{
  visible: boolean
  collection: Collection
  fields: Field[]
  itemsTotal: number
}>()

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void
  (e: 'save-settings', value: CollectionSettingsSavePayload): void
  (e: 'delete-collection'): void
}>()

const collectionName = ref('')

const safeFields = computed(() => {
  return props.fields.filter(field => isSafeFieldName(field.name))
})

const {
  exportFormat,
  exportFormatOptions,
  isExporting,
  handleExport,
  importFormat,
  importMode,
  isImporting,
  importPreview,
  handleSelectFile,
  handleImport,
  cancelImport
} = useCollectionImportExport({
  collection: toRef(props, 'collection'),
  fields: toRef(props, 'fields')
})

function resetSettingsState() {
  collectionName.value = props.collection.name
}

watch(
  () => props.visible,
  isVisible => {
    if (isVisible) {
      resetSettingsState()
    }
  },
  { immediate: true }
)

watch(
  () => props.collection,
  () => {
    if (!props.visible) return
    resetSettingsState()
  }
)

function onVisibilityChange(nextVisible: boolean) {
  if (!nextVisible) {
    cancelSettings()
    return
  }
  emit('update:visible', true)
}

function cancelSettings() {
  emit('update:visible', false)
  resetSettingsState()
}

function saveSettings() {
  emit('save-settings', {
    name: collectionName.value
  })
}
</script>

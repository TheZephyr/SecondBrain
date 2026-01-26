<template>
  <Teleport to="body">
    <div v-if="isOpen" class="confirm-overlay" @click="handleCancel">
      <div class="confirm-dialog" @click.stop>
        <div class="confirm-header">
          <div class="confirm-icon" :style="{ background: iconBg }">
            <component :is="iconComponent" :size="24" :style="{ color: iconColor }" />
          </div>
          <div class="confirm-text">
            <h3>{{ title }}</h3>
            <p>{{ message }}</p>
          </div>
        </div>

        <div class="confirm-actions">
          <button @click="handleCancel" class="btn-cancel">
            {{ cancelText }}
          </button>
          <button 
            @click="handleConfirm" 
            class="btn-confirm"
            :style="{ background: btnBg }"
            @mouseenter="(e) => (e.currentTarget as HTMLElement).style.background = btnHover"
            @mouseleave="(e) => (e.currentTarget as HTMLElement).style.background = btnBg"
          >
            {{ confirmText }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { AlertTriangle, Trash2, Info } from 'lucide-vue-next'

interface Props {
  isOpen: boolean
  title: string
  message: string
  confirmText?: string
  cancelText?: string
  variant?: 'danger' | 'warning' | 'info'
}

const props = withDefaults(defineProps<Props>(), {
  confirmText: 'Confirm',
  cancelText: 'Cancel',
  variant: 'danger'
})

const emit = defineEmits<{
  confirm: []
  cancel: []
}>()

const variantStyles = {
  danger: {
    iconBg: 'rgba(239, 68, 68, 0.1)',
    iconColor: '#ef4444',
    btnBg: '#ef4444',
    btnHover: '#dc2626',
    icon: Trash2
  },
  warning: {
    iconBg: 'rgba(245, 158, 11, 0.1)',
    iconColor: '#f59e0b',
    btnBg: '#f59e0b',
    btnHover: '#d97706',
    icon: AlertTriangle
  },
  info: {
    iconBg: 'rgba(139, 92, 246, 0.1)',
    iconColor: '#8b5cf6',
    btnBg: '#8b5cf6',
    btnHover: '#7c3aed',
    icon: Info
  }
}

const iconBg = computed(() => variantStyles[props.variant].iconBg)
const iconColor = computed(() => variantStyles[props.variant].iconColor)
const btnBg = computed(() => variantStyles[props.variant].btnBg)
const btnHover = computed(() => variantStyles[props.variant].btnHover)
const iconComponent = computed(() => variantStyles[props.variant].icon)

function handleConfirm() {
  emit('confirm')
}

function handleCancel() {
  emit('cancel')
}
</script>

<style scoped>
.confirm-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
  animation: fadeIn 0.2s;
}

.confirm-dialog {
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  padding: 24px;
  max-width: 420px;
  width: 90%;
  animation: slideUp 0.3s;
}

.confirm-header {
  display: flex;
  gap: 16px;
  margin-bottom: 20px;
}

.confirm-icon {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.confirm-text {
  flex: 1;
}

.confirm-text h3 {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0 0 8px 0;
}

.confirm-text p {
  font-size: 14px;
  color: var(--text-secondary);
  line-height: 1.6;
  margin: 0;
}

.confirm-actions {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
}

.btn-cancel {
  padding: 10px 20px;
  background: var(--bg-tertiary);
  color: var(--text-secondary);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  transition: all 0.2s;
}

.btn-cancel:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.btn-confirm {
  padding: 10px 20px;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  transition: all 0.2s;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes slideUp {
  from { 
    opacity: 0;
    transform: translateY(20px);
  }
  to { 
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
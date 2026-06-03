<script setup>
import { onMounted, onUnmounted, watch } from 'vue'
import { X } from '@lucide/vue'

const props = defineProps({
  open: { type: Boolean, default: false },
  title: { type: String, default: '' },
  size: { type: String, default: 'md' }, // sm | md | lg
})
const emit = defineEmits(['update:open', 'close'])

function close() { emit('update:open', false); emit('close') }

function onKey(e) { if (e.key === 'Escape' && props.open) close() }
onMounted(() => window.addEventListener('keydown', onKey))
onUnmounted(() => window.removeEventListener('keydown', onKey))

watch(() => props.open, (v) => {
  document.body.style.overflow = v ? 'hidden' : ''
})
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink-900/40 backdrop-blur-sm"
      @click.self="close"
    >
      <div
        :class="[
          'bg-white rounded-lg shadow-xl w-full',
          size === 'sm' && 'max-w-sm',
          size === 'md' && 'max-w-lg',
          size === 'lg' && 'max-w-2xl',
        ]"
      >
        <div class="flex items-center justify-between border-b border-cream-200 px-5 py-3">
          <h2 class="text-base font-semibold text-ink-900">{{ title }}</h2>
          <button @click="close" class="p-1 rounded hover:bg-cream-100" aria-label="Close">
            <X class="w-4 h-4 text-ink-500" />
          </button>
        </div>
        <div class="p-5">
          <slot />
        </div>
        <div v-if="$slots.footer" class="px-5 py-3 border-t border-cream-200 flex justify-end gap-2">
          <slot name="footer" />
        </div>
      </div>
    </div>
  </Teleport>
</template>

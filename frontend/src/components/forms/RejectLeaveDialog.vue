<script setup>
import { ref, watch } from 'vue'
import Dialog from '@/components/ui/Dialog.vue'

const props = defineProps({
  open: { type: Boolean, default: false },
})
const emit = defineEmits(['update:open', 'reject'])

const reason = ref('')
const submitting = ref(false)

watch(() => props.open, (v) => {
  if (v) { reason.value = ''; submitting.value = false }
})

function submit() {
  if (submitting.value) return
  submitting.value = true
  emit('reject', reason.value.trim())
  emit('update:open', false)
}
</script>

<template>
  <Dialog :open="open" title="Reject leave request" @update:open="(v) => emit('update:open', v)" size="sm">
    <form @submit.prevent="submit" class="space-y-3">
      <div>
        <label class="block text-xs font-medium text-ink-700 mb-1">Reason (optional)</label>
        <textarea v-model="reason" rows="3" placeholder="Provide a reason for rejection…" class="w-full px-3 py-2 rounded-md border border-cream-300 bg-white text-sm focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20" />
      </div>
    </form>
    <template #footer>
      <button @click="emit('update:open', false)" type="button" class="px-3 py-1.5 rounded-md border border-cream-300 hover:bg-cream-50 text-sm">Cancel</button>
      <button @click="submit" :disabled="submitting" class="px-3 py-1.5 rounded-md bg-rose-500 hover:bg-rose-600 disabled:opacity-60 text-white text-sm font-semibold">{{ submitting ? 'Saving…' : 'Reject' }}</button>
    </template>
  </Dialog>
</template>

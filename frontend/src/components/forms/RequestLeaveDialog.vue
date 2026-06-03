<script setup>
import { ref, watch } from 'vue'
import Dialog from '@/components/ui/Dialog.vue'
import { useLeavesStore } from '@/stores/leaves'

const props = defineProps({
  open: { type: Boolean, default: false },
})
const emit = defineEmits(['update:open', 'created'])

const leavesStore = useLeavesStore()

const type = ref('annual')
const startDate = ref('')
const endDate = ref('')
const reason = ref('')
const submitting = ref(false)
const error = ref('')

function reset() {
  type.value = 'annual'
  startDate.value = ''
  endDate.value = ''
  reason.value = ''
  error.value = ''
  submitting.value = false
}

watch(() => props.open, (v) => { if (v) reset() })

async function submit() {
  if (submitting.value) return
  error.value = ''
  submitting.value = true
  try {
    const payload = {
      type: type.value,
      startDate: startDate.value,
      endDate: endDate.value,
    }
    if (reason.value.trim()) payload.reason = reason.value.trim()
    await leavesStore.submit(payload)
    emit('update:open', false)
    emit('created')
  } catch (err) {
    error.value = err?.response?.data?.error?.message || err.message || 'Failed to submit leave request'
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <Dialog :open="open" title="Request leave" @update:open="(v) => emit('update:open', v)">
    <form @submit.prevent="submit" class="space-y-3">
      <div v-if="error" class="p-2.5 rounded-md bg-rose-50 border border-rose-200 text-xs text-rose-700">{{ error }}</div>
      <div>
        <label class="block text-xs font-medium text-ink-700 mb-1">Type</label>
        <select v-model="type" class="w-full px-3 py-2 rounded-md border border-cream-300 bg-white text-sm focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20">
          <option value="annual">Annual</option>
          <option value="sick">Sick</option>
          <option value="unpaid">Unpaid</option>
          <option value="other">Other</option>
        </select>
      </div>
      <div>
        <label class="block text-xs font-medium text-ink-700 mb-1">Start date<span class="text-rose-500">*</span></label>
        <input v-model="startDate" required type="date" class="w-full px-3 py-2 rounded-md border border-cream-300 bg-white text-sm focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20" />
      </div>
      <div>
        <label class="block text-xs font-medium text-ink-700 mb-1">End date<span class="text-rose-500">*</span></label>
        <input v-model="endDate" required type="date" class="w-full px-3 py-2 rounded-md border border-cream-300 bg-white text-sm focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20" />
      </div>
      <div>
        <label class="block text-xs font-medium text-ink-700 mb-1">Reason</label>
        <textarea v-model="reason" rows="3" class="w-full px-3 py-2 rounded-md border border-cream-300 bg-white text-sm focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20" />
      </div>
    </form>
    <template #footer>
      <button @click="emit('update:open', false)" type="button" class="px-3 py-1.5 rounded-md border border-cream-300 hover:bg-cream-50 text-sm">Cancel</button>
      <button @click="submit" :disabled="submitting" class="px-3 py-1.5 rounded-md bg-brand-500 hover:bg-brand-600 disabled:opacity-60 text-white text-sm font-semibold">{{ submitting ? 'Saving…' : 'Submit' }}</button>
    </template>
  </Dialog>
</template>

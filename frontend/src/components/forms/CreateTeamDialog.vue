<script setup>
import { ref, watch, onMounted } from 'vue'
import { storeToRefs } from 'pinia'
import Dialog from '@/components/ui/Dialog.vue'
import { useTeamsStore } from '@/stores/teams'
import { useEmployeesStore } from '@/stores/employees'

const props = defineProps({
  open: { type: Boolean, default: false },
})
const emit = defineEmits(['update:open', 'created'])

const teamsStore = useTeamsStore()
const employeesStore = useEmployeesStore()
const { list: employees } = storeToRefs(employeesStore)

const name = ref('')
const description = ref('')
const leadEmployeeId = ref('')
const submitting = ref(false)
const error = ref('')

function reset() {
  name.value = ''
  description.value = ''
  leadEmployeeId.value = ''
  error.value = ''
  submitting.value = false
}

onMounted(() => {
  if (!employees.value.length) employeesStore.fetchList({ perPage: 100 })
})

watch(() => props.open, (v) => {
  if (v) {
    reset()
    if (!employees.value.length) employeesStore.fetchList({ perPage: 100 })
  }
})

async function submit() {
  if (submitting.value) return
  error.value = ''
  submitting.value = true
  try {
    const payload = { name: name.value.trim() }
    if (description.value.trim()) payload.description = description.value.trim()
    if (leadEmployeeId.value) payload.leadEmployeeId = Number(leadEmployeeId.value)
    await teamsStore.create(payload)
    emit('update:open', false)
    emit('created')
  } catch (err) {
    error.value = err?.response?.data?.error?.message || err.message || 'Failed to create team'
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <Dialog :open="open" title="New team" @update:open="(v) => emit('update:open', v)">
    <form @submit.prevent="submit" class="space-y-3">
      <div v-if="error" class="p-2.5 rounded-md bg-rose-50 border border-rose-200 text-xs text-rose-700">{{ error }}</div>
      <div>
        <label class="block text-xs font-medium text-ink-700 mb-1">Name<span class="text-rose-500">*</span></label>
        <input v-model="name" required type="text" class="w-full px-3 py-2 rounded-md border border-cream-300 bg-white text-sm focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20" />
      </div>
      <div>
        <label class="block text-xs font-medium text-ink-700 mb-1">Description</label>
        <textarea v-model="description" rows="3" class="w-full px-3 py-2 rounded-md border border-cream-300 bg-white text-sm focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20" />
      </div>
      <div>
        <label class="block text-xs font-medium text-ink-700 mb-1">Lead</label>
        <select v-model="leadEmployeeId" class="w-full px-3 py-2 rounded-md border border-cream-300 bg-white text-sm focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20">
          <option value="">— Select —</option>
          <option v-for="e in employees" :key="e.id" :value="e.id">{{ e.name }}</option>
        </select>
      </div>
    </form>
    <template #footer>
      <button @click="emit('update:open', false)" type="button" class="px-3 py-1.5 rounded-md border border-cream-300 hover:bg-cream-50 text-sm">Cancel</button>
      <button @click="submit" :disabled="submitting" class="px-3 py-1.5 rounded-md bg-brand-500 hover:bg-brand-600 disabled:opacity-60 text-white text-sm font-semibold">{{ submitting ? 'Saving…' : 'Save' }}</button>
    </template>
  </Dialog>
</template>

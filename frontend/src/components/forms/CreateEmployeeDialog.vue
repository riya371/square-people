<script setup>
import { ref, watch, onMounted } from 'vue'
import { storeToRefs } from 'pinia'
import Dialog from '@/components/ui/Dialog.vue'
import { useEmployeesStore } from '@/stores/employees'
import { useDepartmentsStore } from '@/stores/departments'

const props = defineProps({
  open: { type: Boolean, default: false },
})
const emit = defineEmits(['update:open', 'created'])

const employeesStore = useEmployeesStore()
const departmentsStore = useDepartmentsStore()
const { list: departments } = storeToRefs(departmentsStore)

const name = ref('')
const email = ref('')
const employeeCode = ref('')
const phone = ref('')
const departmentId = ref('')
const hireDate = ref('')
const submitting = ref(false)
const error = ref('')

function reset() {
  name.value = ''
  email.value = ''
  employeeCode.value = ''
  phone.value = ''
  departmentId.value = ''
  hireDate.value = ''
  error.value = ''
  submitting.value = false
}

onMounted(() => {
  if (!departments.value.length) departmentsStore.fetchList()
})

watch(() => props.open, (v) => {
  if (v) {
    reset()
    if (!departments.value.length) departmentsStore.fetchList()
  }
})

async function submit() {
  if (submitting.value) return
  error.value = ''
  submitting.value = true
  try {
    const payload = {
      name: name.value.trim(),
      email: email.value.trim(),
      employeeCode: employeeCode.value.trim(),
    }
    if (phone.value.trim()) payload.phone = phone.value.trim()
    if (departmentId.value) payload.departmentId = Number(departmentId.value)
    if (hireDate.value) payload.hireDate = hireDate.value
    await employeesStore.create(payload)
    emit('update:open', false)
    emit('created')
  } catch (err) {
    error.value = err?.response?.data?.error?.message || err.message || 'Failed to create employee'
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <Dialog :open="open" title="New employee" @update:open="(v) => emit('update:open', v)">
    <form @submit.prevent="submit" class="space-y-3">
      <div v-if="error" class="p-2.5 rounded-md bg-rose-50 border border-rose-200 text-xs text-rose-700">{{ error }}</div>
      <div>
        <label class="block text-xs font-medium text-ink-700 mb-1">Name<span class="text-rose-500">*</span></label>
        <input v-model="name" required type="text" class="w-full px-3 py-2 rounded-md border border-cream-300 bg-white text-sm focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20" />
      </div>
      <div>
        <label class="block text-xs font-medium text-ink-700 mb-1">Email<span class="text-rose-500">*</span></label>
        <input v-model="email" required type="email" class="w-full px-3 py-2 rounded-md border border-cream-300 bg-white text-sm focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20" />
      </div>
      <div>
        <label class="block text-xs font-medium text-ink-700 mb-1">Employee code<span class="text-rose-500">*</span></label>
        <input v-model="employeeCode" required type="text" class="w-full px-3 py-2 rounded-md border border-cream-300 bg-white text-sm focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20" />
      </div>
      <div>
        <label class="block text-xs font-medium text-ink-700 mb-1">Phone</label>
        <input v-model="phone" type="text" class="w-full px-3 py-2 rounded-md border border-cream-300 bg-white text-sm focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20" />
      </div>
      <div>
        <label class="block text-xs font-medium text-ink-700 mb-1">Department</label>
        <select v-model="departmentId" class="w-full px-3 py-2 rounded-md border border-cream-300 bg-white text-sm focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20">
          <option value="">— Select —</option>
          <option v-for="d in departments" :key="d.id" :value="d.id">{{ d.name }}</option>
        </select>
      </div>
      <div>
        <label class="block text-xs font-medium text-ink-700 mb-1">Hire date</label>
        <input v-model="hireDate" type="date" class="w-full px-3 py-2 rounded-md border border-cream-300 bg-white text-sm focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20" />
      </div>
    </form>
    <template #footer>
      <button @click="emit('update:open', false)" type="button" class="px-3 py-1.5 rounded-md border border-cream-300 hover:bg-cream-50 text-sm">Cancel</button>
      <button @click="submit" :disabled="submitting" class="px-3 py-1.5 rounded-md bg-brand-500 hover:bg-brand-600 disabled:opacity-60 text-white text-sm font-semibold">{{ submitting ? 'Saving…' : 'Save' }}</button>
    </template>
  </Dialog>
</template>

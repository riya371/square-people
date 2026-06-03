<script setup>
import { ref, watch, onMounted } from 'vue'
import { storeToRefs } from 'pinia'
import Dialog from '@/components/ui/Dialog.vue'
import { useEmployeesStore } from '@/stores/employees'
import { useDepartmentsStore } from '@/stores/departments'

const props = defineProps({
  open: { type: Boolean, default: false },
  employee: { type: Object, default: null },
})
const emit = defineEmits(['update:open', 'saved'])

const employeesStore = useEmployeesStore()
const departmentsStore = useDepartmentsStore()
const { list: departments } = storeToRefs(departmentsStore)

const name = ref('')
const email = ref('')
const phone = ref('')
const employeeCode = ref('')
const departmentId = ref('')
const status = ref('active')
const submitting = ref(false)
const error = ref('')

function fill() {
  const e = props.employee?.raw || props.employee
  if (!e) return
  name.value = e.name || ''
  email.value = e.email || ''
  phone.value = e.phone || ''
  employeeCode.value = e.employeeCode || ''
  departmentId.value = e.departmentId ? String(e.departmentId) : ''
  status.value = e.status || 'active'
  error.value = ''
  submitting.value = false
}

onMounted(() => {
  if (!departments.value.length) departmentsStore.fetchList()
})

watch(() => props.open, (v) => {
  if (v) {
    fill()
    if (!departments.value.length) departmentsStore.fetchList()
  }
})
watch(() => props.employee, () => { if (props.open) fill() })

async function submit() {
  if (submitting.value) return
  error.value = ''
  submitting.value = true
  try {
    const payload = {
      name: name.value.trim(),
      email: email.value.trim(),
      status: status.value,
    }
    const trimmedPhone = phone.value.trim()
    if (trimmedPhone) payload.phone = trimmedPhone
    const trimmedCode = employeeCode.value.trim()
    if (trimmedCode) payload.employeeCode = trimmedCode
    if (departmentId.value) payload.departmentId = Number(departmentId.value)
    else payload.departmentId = null
    const id = props.employee?.id || props.employee?.raw?.id
    await employeesStore.update(id, payload)
    emit('update:open', false)
    emit('saved')
  } catch (err) {
    error.value = err?.response?.data?.error?.message || err.message || 'Failed to update employee'
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <Dialog :open="open" title="Edit employee" @update:open="(v) => emit('update:open', v)">
    <form @submit.prevent="submit" class="space-y-3">
      <div v-if="error" class="p-2.5 rounded-md bg-rose-50 border border-rose-200 text-xs text-rose-700">{{ error }}</div>
      <div>
        <label class="block text-xs font-medium text-ink-700 mb-1">Name</label>
        <input v-model="name" type="text" class="w-full px-3 py-2 rounded-md border border-cream-300 bg-white text-sm focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20" />
      </div>
      <div>
        <label class="block text-xs font-medium text-ink-700 mb-1">Email</label>
        <input v-model="email" type="email" class="w-full px-3 py-2 rounded-md border border-cream-300 bg-white text-sm focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20" />
      </div>
      <div>
        <label class="block text-xs font-medium text-ink-700 mb-1">Phone</label>
        <input v-model="phone" type="text" class="w-full px-3 py-2 rounded-md border border-cream-300 bg-white text-sm focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20" />
      </div>
      <div>
        <label class="block text-xs font-medium text-ink-700 mb-1">Employee code <span class="text-ink-500 font-normal">(used for kiosk PIN sign-in)</span></label>
        <input v-model="employeeCode" type="text" placeholder="e.g. EMP-0042" class="w-full px-3 py-2 rounded-md border border-cream-300 bg-white text-sm focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20" />
      </div>
      <div>
        <label class="block text-xs font-medium text-ink-700 mb-1">Department</label>
        <select v-model="departmentId" class="w-full px-3 py-2 rounded-md border border-cream-300 bg-white text-sm focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20">
          <option value="">— None —</option>
          <option v-for="d in departments" :key="d.id" :value="d.id">{{ d.name }}</option>
        </select>
      </div>
      <div>
        <label class="block text-xs font-medium text-ink-700 mb-1">Status</label>
        <select v-model="status" class="w-full px-3 py-2 rounded-md border border-cream-300 bg-white text-sm focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20">
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>
    </form>
    <template #footer>
      <button @click="emit('update:open', false)" type="button" class="px-3 py-1.5 rounded-md border border-cream-300 hover:bg-cream-50 text-sm">Cancel</button>
      <button @click="submit" :disabled="submitting" class="px-3 py-1.5 rounded-md bg-brand-500 hover:bg-brand-600 disabled:opacity-60 text-white text-sm font-semibold">{{ submitting ? 'Saving…' : 'Save' }}</button>
    </template>
  </Dialog>
</template>

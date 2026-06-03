<script setup>
import { ref, watch, toRef, computed } from 'vue'
import LeaveRequestsTable from './LeaveRequestsTable.vue'
import { useEmployeesStore } from '@/stores/employees'
import { shortDate, relative } from '@/lib/dates'

const props = defineProps({
  employeeId: { type: [String, Number], required: true },
})
const store = useEmployeesStore()

const rawRows = ref([])
const loading = ref(false)
const error = ref('')

const rows = computed(() => rawRows.value.map((l, i) => ({
  id: String(l.id ?? i),
  type: l.type,
  startDate: shortDate(l.startDate),
  endDate: shortDate(l.endDate),
  days: l.days,
  status: l.status,
  submittedAt: l.submittedAt ? relative(l.submittedAt) : '',
})))

async function load(id) {
  if (!id) return
  loading.value = true
  error.value = ''
  try {
    rawRows.value = await store.fetchLeaves(id)
  } catch (err) {
    error.value = err?.response?.data?.error?.message || err.message
  } finally { loading.value = false }
}

watch(toRef(props, 'employeeId'), (id) => load(id), { immediate: true })
</script>

<template>
  <div class="bg-white rounded-lg border border-cream-200 overflow-hidden">
    <div v-if="loading" class="p-5 text-sm text-ink-500">Loading leaves…</div>
    <div v-else-if="error" class="p-5 text-sm text-rose-600">{{ error }}</div>
    <div v-else-if="!rows.length" class="p-5 text-sm text-ink-500">No leave requests.</div>
    <LeaveRequestsTable v-else :rows="rows" />
  </div>
</template>

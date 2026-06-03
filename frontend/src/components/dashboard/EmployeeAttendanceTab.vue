<script setup>
import { ref, watch, toRef } from 'vue'
import StatusPill from './StatusPill.vue'
import { useEmployeesStore } from '@/stores/employees'
import { shortDate } from '@/lib/dates'

const props = defineProps({
  employeeId: { type: [String, Number], required: true },
})
const store = useEmployeesStore()

const rows = ref([])
const loading = ref(false)
const error = ref('')

function timePart(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

async function load(id) {
  if (!id) return
  loading.value = true
  error.value = ''
  try {
    rows.value = await store.fetchAttendance(id)
  } catch (err) {
    error.value = err?.response?.data?.error?.message || err.message
  } finally { loading.value = false }
}

watch(toRef(props, 'employeeId'), (id) => load(id), { immediate: true })
</script>

<template>
  <div class="bg-white rounded-lg border border-cream-200 overflow-hidden">
    <div v-if="loading" class="p-5 text-sm text-ink-500">Loading attendance…</div>
    <div v-else-if="error" class="p-5 text-sm text-rose-600">{{ error }}</div>
    <div v-else-if="!rows.length" class="p-5 text-sm text-ink-500">No attendance records.</div>
    <table v-else class="w-full text-sm">
      <thead class="bg-cream-50 text-left text-xs uppercase text-ink-500 tracking-wider">
        <tr>
          <th class="px-4 py-3 font-medium">Date</th>
          <th class="px-4 py-3 font-medium">Signed in</th>
          <th class="px-4 py-3 font-medium">Signed out</th>
          <th class="px-4 py-3 font-medium">Status</th>
        </tr>
      </thead>
      <tbody class="divide-y divide-cream-200">
        <tr v-for="(r, i) in rows" :key="i">
          <td class="px-4 py-3 font-medium">{{ shortDate(r.loggedDate) }}</td>
          <td class="px-4 py-3 text-ink-600">{{ timePart(r.signedInAt) }}</td>
          <td class="px-4 py-3 text-ink-600">{{ timePart(r.signedOutAt) }}</td>
          <td class="px-4 py-3"><StatusPill :tone="r.status">{{ r.status }}</StatusPill></td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

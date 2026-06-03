<script setup>
import { ref, watch, toRef } from 'vue'
import StatusPill from './StatusPill.vue'
import RoleChip from './RoleChip.vue'
import { useEmployeesStore } from '@/stores/employees'

const props = defineProps({
  employeeId: { type: [String, Number], required: true },
})
const store = useEmployeesStore()

const tasks = ref([])
const loading = ref(false)
const error = ref('')

const STATUS_LABEL = { pending: 'Pending', inProgress: 'In progress', completed: 'Completed' }
const PRIORITY_TONE = { high: 'rose', medium: 'amber', low: 'cream' }

async function load(id) {
  if (!id) return
  loading.value = true
  error.value = ''
  try {
    tasks.value = await store.fetchTasks(id)
  } catch (err) {
    error.value = err?.response?.data?.error?.message || err.message
  } finally { loading.value = false }
}

watch(toRef(props, 'employeeId'), (id) => load(id), { immediate: true })
</script>

<template>
  <div class="bg-white rounded-lg border border-cream-200 overflow-hidden">
    <div v-if="loading" class="p-5 text-sm text-ink-500">Loading tasks…</div>
    <div v-else-if="error" class="p-5 text-sm text-rose-600">{{ error }}</div>
    <div v-else-if="!tasks.length" class="p-5 text-sm text-ink-500">No tasks assigned.</div>
    <table v-else class="w-full text-sm">
      <thead class="bg-cream-50 text-left text-xs uppercase text-ink-500 tracking-wider">
        <tr>
          <th class="px-4 py-3 font-medium">Title</th>
          <th class="px-4 py-3 font-medium">Project</th>
          <th class="px-4 py-3 font-medium">Status</th>
          <th class="px-4 py-3 font-medium">Priority</th>
        </tr>
      </thead>
      <tbody class="divide-y divide-cream-200">
        <tr v-for="t in tasks" :key="t.id">
          <td class="px-4 py-3 font-medium">{{ t.title }}</td>
          <td class="px-4 py-3 text-ink-600">{{ t.project?.name || '—' }}</td>
          <td class="px-4 py-3"><StatusPill :tone="t.status">{{ STATUS_LABEL[t.status] || t.status }}</StatusPill></td>
          <td class="px-4 py-3"><RoleChip :tone="PRIORITY_TONE[t.priority]">{{ t.priority }}</RoleChip></td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

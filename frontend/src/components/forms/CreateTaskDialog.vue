<script setup>
import { ref, watch, onMounted } from 'vue'
import { storeToRefs } from 'pinia'
import Dialog from '@/components/ui/Dialog.vue'
import { useTasksStore } from '@/stores/tasks'
import { useProjectsStore } from '@/stores/projects'
import { useEmployeesStore } from '@/stores/employees'

const props = defineProps({
  open: { type: Boolean, default: false },
  defaultStatus: { type: String, default: 'pending' },
})
const emit = defineEmits(['update:open', 'created'])

const tasksStore = useTasksStore()
const projectsStore = useProjectsStore()
const employeesStore = useEmployeesStore()
const { list: projects } = storeToRefs(projectsStore)
const { list: employees } = storeToRefs(employeesStore)

const title = ref('')
const projectId = ref('')
const priority = ref('medium')
const assigneeId = ref('')
const status = ref(props.defaultStatus)
const submitting = ref(false)
const error = ref('')

function reset() {
  title.value = ''
  projectId.value = ''
  priority.value = 'medium'
  assigneeId.value = ''
  status.value = props.defaultStatus
  error.value = ''
  submitting.value = false
}

onMounted(() => {
  if (!projects.value.length) projectsStore.fetchList()
  if (!employees.value.length) employeesStore.fetchList({ perPage: 100 })
})

watch(() => props.open, (v) => {
  if (v) {
    reset()
    if (!projects.value.length) projectsStore.fetchList()
    if (!employees.value.length) employeesStore.fetchList({ perPage: 100 })
  }
})
watch(() => props.defaultStatus, (v) => { status.value = v })

// Auto-select the only project so the user doesn't have to pick one when there's no choice.
watch(projects, (v) => {
  if (!projectId.value && v.length === 1) projectId.value = v[0].id
}, { immediate: true })

async function submit() {
  if (submitting.value) return
  error.value = ''
  submitting.value = true
  try {
    const payload = {
      title: title.value.trim(),
      projectId: Number(projectId.value),
      priority: priority.value,
      status: status.value,
    }
    if (assigneeId.value) payload.assigneeId = Number(assigneeId.value)
    await tasksStore.create(payload)
    emit('update:open', false)
    emit('created')
  } catch (err) {
    error.value = err?.response?.data?.error?.message || err.message || 'Failed to create task'
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <Dialog :open="open" title="New task" @update:open="(v) => emit('update:open', v)">
    <form @submit.prevent="submit" class="space-y-3">
      <div v-if="error" class="p-2.5 rounded-md bg-rose-50 border border-rose-200 text-xs text-rose-700">{{ error }}</div>
      <div>
        <label class="block text-xs font-medium text-ink-700 mb-1">Title<span class="text-rose-500">*</span></label>
        <input v-model="title" required type="text" class="w-full px-3 py-2 rounded-md border border-cream-300 bg-white text-sm focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20" />
      </div>
      <div>
        <label class="block text-xs font-medium text-ink-700 mb-1">Project<span class="text-rose-500">*</span></label>
        <select v-model="projectId" required class="w-full px-3 py-2 rounded-md border border-cream-300 bg-white text-sm focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20">
          <option value="">— Select —</option>
          <option v-for="p in projects" :key="p.id" :value="p.id">{{ p.name }}</option>
        </select>
      </div>
      <div>
        <label class="block text-xs font-medium text-ink-700 mb-1">Priority</label>
        <select v-model="priority" class="w-full px-3 py-2 rounded-md border border-cream-300 bg-white text-sm focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20">
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
        </select>
      </div>
      <div>
        <label class="block text-xs font-medium text-ink-700 mb-1">Assignee</label>
        <select v-model="assigneeId" class="w-full px-3 py-2 rounded-md border border-cream-300 bg-white text-sm focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20">
          <option value="">— Unassigned —</option>
          <option v-for="e in employees" :key="e.id" :value="e.id">{{ e.name }}</option>
        </select>
      </div>
      <div>
        <label class="block text-xs font-medium text-ink-700 mb-1">Status</label>
        <select v-model="status" class="w-full px-3 py-2 rounded-md border border-cream-300 bg-white text-sm focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20">
          <option value="pending">Pending</option>
          <option value="inProgress">In progress</option>
          <option value="completed">Completed</option>
        </select>
      </div>
    </form>
    <template #footer>
      <button @click="emit('update:open', false)" type="button" class="px-3 py-1.5 rounded-md border border-cream-300 hover:bg-cream-50 text-sm">Cancel</button>
      <button @click="submit" :disabled="submitting" class="px-3 py-1.5 rounded-md bg-brand-500 hover:bg-brand-600 disabled:opacity-60 text-white text-sm font-semibold">{{ submitting ? 'Saving…' : 'Save' }}</button>
    </template>
  </Dialog>
</template>

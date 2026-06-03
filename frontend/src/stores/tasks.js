import { defineStore } from 'pinia'
import { ref } from 'vue'
import { http } from '@/lib/http'
import { computeAvatar } from '@/lib/avatar'

function decorate(t) {
  return {
    id: String(t.id),
    code: t.code || `#${t.id}`,
    title: t.title,
    priority: t.priority || 'medium',
    project: t.project?.name || '',
    projectId: t.projectId,
    status: t.status,
    position: t.position,
    assignee: t.assignee ? { ...computeAvatar(t.assignee.name), name: t.assignee.name } : null,
    subtasks: t.subtasksCount ?? undefined,
    completed: t.status === 'completed',
  }
}

export const useTasksStore = defineStore('tasks', () => {
  const columns = ref({ pending: [], inProgress: [], completed: [] })
  const loading = ref(false)
  const error = ref(null)

  async function fetchKanban(projectId) {
    loading.value = true; error.value = null
    try {
      const params = projectId ? { projectId } : {}
      const { data } = await http.get('/api/tasks/kanban', { params })
      columns.value = {
        pending: data.pending.map(decorate),
        inProgress: data.inProgress.map(decorate),
        completed: data.completed.map(decorate),
      }
    } catch (err) { error.value = err?.response?.data?.error?.message || err.message }
    finally { loading.value = false }
  }

  async function move(taskId, toColumn, toIndex) {
    try {
      await http.post(`/api/tasks/${taskId}/move`, { toColumn, toIndex })
    } catch (err) {
      // Refetch on failure to reconcile state.
      error.value = err?.response?.data?.error?.message || err.message
      await fetchKanban()
    }
  }

  async function create(payload) {
    await http.post('/api/tasks', payload)
    await fetchKanban()
  }

  return { columns, loading, error, fetchKanban, move, create }
})

import { defineStore } from 'pinia'
import { ref } from 'vue'
import { http } from '@/lib/http'
import { shortDate } from '@/lib/dates'

function decorate(p) {
  return {
    id: String(p.id),
    name: p.name,
    description: p.description || '',
    scope: p.description || (p.teams?.map((t) => t.name).join(', ') || ''),
    status: p.status,
    progress: typeof p.progress === 'number' ? p.progress : 0,
    tasksDone: p.tasksDone ?? 0,
    tasksTotal: p.tasksTotal ?? 0,
    dueDate: p.dueDate ? shortDate(p.dueDate) : '',
    dueDateRaw: p.dueDate ? String(p.dueDate).slice(0, 10) : '',
    teams: Array.isArray(p.teams) ? p.teams.map((t) => ({ id: String(t.id), name: t.name })) : [],
  }
}

export const useProjectsStore = defineStore('projects', () => {
  const list = ref([])
  const byId = ref({})
  const loading = ref(false)
  const error = ref(null)

  async function fetchList() {
    loading.value = true; error.value = null
    try {
      const { data } = await http.get('/api/projects', { params: { perPage: 100 } })
      list.value = data.data.map(decorate)
    } catch (err) { error.value = err?.response?.data?.error?.message || err.message }
    finally { loading.value = false }
  }
  async function fetchOne(id) {
    loading.value = true; error.value = null
    try {
      const { data } = await http.get(`/api/projects/${id}`)
      const dec = decorate(data)
      byId.value = { ...byId.value, [String(id)]: dec }
      return dec
    } catch (err) {
      error.value = err?.response?.data?.error?.message || err.message
      return null
    } finally { loading.value = false }
  }
  async function create(payload) {
    await http.post('/api/projects', payload)
    await fetchList()
  }
  async function update(id, payload) {
    await http.patch(`/api/projects/${id}`, payload)
    await fetchList()
  }
  async function remove(id) {
    await http.delete(`/api/projects/${id}`)
    await fetchList()
  }
  async function setStatus(id, status) {
    await http.patch(`/api/projects/${id}`, { status })
    await fetchList()
  }
  async function setTeams(id, teamIds) {
    await http.post(`/api/projects/${id}/teams`, { teamIds })
    await fetchList()
  }
  async function removeTeam(id, teamId) {
    await http.delete(`/api/projects/${id}/teams/${teamId}`)
    await fetchList()
  }
  return { list, byId, loading, error, fetchList, fetchOne, create, update, remove, setStatus, setTeams, removeTeam }
})

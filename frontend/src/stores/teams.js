import { defineStore } from 'pinia'
import { ref } from 'vue'
import { http } from '@/lib/http'
import { computeAvatar } from '@/lib/avatar'

function buildAvatars(t) {
  if (Array.isArray(t.members) && t.members.length) {
    return t.members.map((m) => computeAvatar(m.name))
  }
  return t.lead ? [computeAvatar(t.lead.name)] : []
}

function decorate(t) {
  return {
    id: String(t.id),
    name: t.name,
    description: t.description || '',
    lead: t.lead?.name || '—',
    leadEmployeeId: t.lead?.id ? String(t.lead.id) : (t.leadEmployeeId ? String(t.leadEmployeeId) : ''),
    memberCount: t.memberCount ?? (Array.isArray(t.members) ? t.members.length : 0),
    activeProjects: t.activeProjectCount ?? 0,
    avatars: buildAvatars(t),
    members: Array.isArray(t.members) ? t.members.map((m) => ({ id: String(m.id), name: m.name })) : [],
  }
}

export const useTeamsStore = defineStore('teams', () => {
  const list = ref([])
  const byId = ref({})
  const loading = ref(false)
  const error = ref(null)

  async function fetchList() {
    loading.value = true; error.value = null
    try {
      const { data } = await http.get('/api/teams', { params: { perPage: 100 } })
      list.value = data.data.map(decorate)
    } catch (err) { error.value = err?.response?.data?.error?.message || err.message }
    finally { loading.value = false }
  }
  async function fetchOne(id) {
    loading.value = true; error.value = null
    try {
      const { data } = await http.get(`/api/teams/${id}`)
      const dec = decorate(data)
      byId.value = { ...byId.value, [String(id)]: dec }
      return dec
    } catch (err) {
      error.value = err?.response?.data?.error?.message || err.message
      return null
    } finally { loading.value = false }
  }
  async function create(payload) {
    await http.post('/api/teams', payload)
    await fetchList()
  }
  async function update(id, payload) {
    await http.patch(`/api/teams/${id}`, payload)
    await fetchList()
  }
  async function remove(id) {
    await http.delete(`/api/teams/${id}`)
    await fetchList()
  }
  async function setMembers(id, employeeIds) {
    await http.post(`/api/teams/${id}/members`, { employeeIds })
    await fetchList()
  }
  async function removeMember(id, employeeId) {
    await http.delete(`/api/teams/${id}/members/${employeeId}`)
    await fetchList()
  }
  return { list, byId, loading, error, fetchList, fetchOne, create, update, remove, setMembers, removeMember }
})

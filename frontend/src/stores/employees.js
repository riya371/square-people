import { defineStore } from 'pinia'
import { ref } from 'vue'
import { http } from '@/lib/http'
import { computeAvatar } from '@/lib/avatar'
import { roleTone, statusTone } from '@/lib/tone'
import { shortDate } from '@/lib/dates'

function decorate(e) {
  if (!e) return null
  return {
    id: String(e.id),
    name: e.name,
    email: e.email,
    phone: e.phone,
    employeeCode: e.employeeCode || '',
    departmentId: e.departmentId,
    department: e.department?.name || '—',
    status: e.status,
    statusTone: statusTone(e.status),
    hireDate: e.hireDate ? shortDate(e.hireDate) : '',
    avatar: computeAvatar(e.name),
    roles: (e.roles || []).map((r) => ({ id: r.id, label: r.name, tone: roleTone(r.name) })),
    teamsLed: e.teamsLed || [],
    stats: e.stats || { hoursThisMonth: 0, daysPresent: 0, daysExpected: 0, tasksCompleted: 0 },
    raw: e,
  }
}

export const useEmployeesStore = defineStore('employees', () => {
  const list = ref([])
  const byId = ref({})         // id → decorated detail
  const loading = ref(false)
  const error = ref(null)

  async function fetchList(params = {}) {
    loading.value = true
    error.value = null
    try {
      const { data } = await http.get('/api/employees', { params })
      list.value = data.data.map(decorate)
    } catch (err) {
      error.value = err?.response?.data?.error?.message || err.message
    } finally { loading.value = false }
  }

  async function fetchOne(id) {
    loading.value = true
    error.value = null
    try {
      const { data } = await http.get(`/api/employees/${id}`)
      const dec = decorate(data)
      byId.value = { ...byId.value, [String(id)]: dec }
      return dec
    } catch (err) {
      error.value = err?.response?.data?.error?.message || err.message
      return null
    } finally { loading.value = false }
  }

  async function create(payload) {
    const { data } = await http.post('/api/employees', payload)
    await fetchList({ perPage: 50 })
    return decorate(data)
  }
  async function update(id, payload) {
    const { data } = await http.patch(`/api/employees/${id}`, payload)
    const dec = decorate(data)
    byId.value = { ...byId.value, [String(id)]: dec }
    return dec
  }
  async function assignRoles(id, roleIds) {
    const { data } = await http.post(`/api/employees/${id}/roles`, { roleIds })
    const dec = decorate(data)
    byId.value = { ...byId.value, [String(id)]: dec }
    return dec
  }
  async function removeRole(id, roleId) {
    await http.delete(`/api/employees/${id}/roles/${roleId}`)
    return fetchOne(id)
  }
  async function fetchTasks(id) {
    const { data } = await http.get(`/api/employees/${id}/tasks`)
    return data.data
  }
  async function fetchAttendance(id) {
    const { data } = await http.get(`/api/employees/${id}/attendance`)
    return data.data
  }
  async function fetchLeaves(id) {
    const { data } = await http.get(`/api/employees/${id}/leaves`)
    return data.data
  }

  return { list, byId, loading, error, fetchList, fetchOne, create, update, assignRoles, removeRole, fetchTasks, fetchAttendance, fetchLeaves }
})

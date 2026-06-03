import { defineStore } from 'pinia'
import { ref } from 'vue'
import { http } from '@/lib/http'
import { computeAvatar } from '@/lib/avatar'
import { shortDate, relative } from '@/lib/dates'

function decoratePending(l) {
  return {
    id: String(l.id),
    employee: {
      name: l.employee?.name,
      role: l.employee?.roles?.[0]?.name || '',
      ...computeAvatar(l.employee?.name || ''),
    },
    days: l.days,
    type: l.type,
    startDate: shortDate(l.startDate),
    endDate: shortDate(l.endDate),
    reason: l.reason || '',
    submittedAt: relative(l.submittedAt),
  }
}

function decorateMine(l) {
  return {
    id: String(l.id),
    type: l.type,
    startDate: shortDate(l.startDate),
    endDate: shortDate(l.endDate),
    days: l.days,
    status: l.status,
    submittedAt: relative(l.submittedAt),
  }
}

export const useLeavesStore = defineStore('leaves', () => {
  const pending = ref([])
  const mine = ref([])
  const loading = ref(false)
  const error = ref(null)

  async function refresh() {
    loading.value = true; error.value = null
    try {
      const [p, m] = await Promise.all([
        http.get('/api/leaves/pending'),
        http.get('/api/leaves/mine'),
      ])
      pending.value = p.data.data.map(decoratePending)
      mine.value = m.data.data.map(decorateMine)
    } catch (err) { error.value = err?.response?.data?.error?.message || err.message }
    finally { loading.value = false }
  }
  async function approve(id) { await http.post(`/api/leaves/${id}/approve`, {}); await refresh() }
  async function reject(id, reason) { await http.post(`/api/leaves/${id}/reject`, reason ? { reason } : {}); await refresh() }
  async function submit({ type, startDate, endDate, reason }) { await http.post('/api/leaves', { type, startDate, endDate, reason }); await refresh() }
  async function cancelMine(id) { await http.delete(`/api/leaves/${id}`); await refresh() }

  return { pending, mine, loading, error, refresh, approve, reject, submit, cancelMine }
})

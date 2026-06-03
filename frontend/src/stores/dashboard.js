import { defineStore } from 'pinia'
import { ref } from 'vue'
import { http } from '@/lib/http'

export const useDashboardStore = defineStore('dashboard', () => {
  const stats = ref(null)
  const activity = ref([])
  const hours = ref([])
  const loading = ref(false)
  const error = ref(null)

  async function fetch() {
    loading.value = true
    error.value = null
    try {
      const [s, a, h] = await Promise.all([
        http.get('/api/dashboard/stats'),
        http.get('/api/dashboard/activity', { params: { limit: 10 } }),
        http.get('/api/dashboard/hours-this-week'),
      ])
      stats.value = s.data
      activity.value = a.data.data
      hours.value = h.data.data
    } catch (err) {
      error.value = err?.response?.data?.error?.message || err.message
    } finally {
      loading.value = false
    }
  }

  return { stats, activity, hours, loading, error, fetch }
})

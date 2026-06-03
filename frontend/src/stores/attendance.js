import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { http } from '@/lib/http'

export const useAttendanceStore = defineStore('attendance', () => {
  const today = ref(null)                 // { signedInAt, signedOutAt, status }
  const monthData = ref({})               // { "YYYY-MM-DD": "present" | ... }
  const monthCursor = ref(new Date())     // anchor for prev/next
  const loading = ref(false)
  const error = ref(null)

  const month = computed(() => ({ year: monthCursor.value.getFullYear(), month: monthCursor.value.getMonth() + 1 }))
  const signedInAt = computed(() => (today.value?.signedInAt && !today.value?.signedOutAt) ? today.value.signedInAt : null)

  async function refresh() {
    loading.value = true; error.value = null
    try {
      const [t, m] = await Promise.all([
        http.get('/api/attendance/today'),
        http.get('/api/attendance/month', { params: month.value }),
      ])
      today.value = t.data
      monthData.value = m.data
    } catch (err) { error.value = err?.response?.data?.error?.message || err.message }
    finally { loading.value = false }
  }

  async function signIn() { await http.post('/api/attendance/sign-in'); await refresh() }
  async function signOut() { await http.post('/api/attendance/sign-out'); await refresh() }

  function prev() { const d = new Date(monthCursor.value); d.setMonth(d.getMonth() - 1); monthCursor.value = d; refresh() }
  function next() { const d = new Date(monthCursor.value); d.setMonth(d.getMonth() + 1); monthCursor.value = d; refresh() }

  return { today, monthData, monthCursor, loading, error, month, signedInAt, refresh, signIn, signOut, prev, next }
})

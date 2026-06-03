import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { http } from '@/lib/http'
import { fmtTimer } from '@/lib/dates'

export const useTimeStore = defineStore('time', () => {
  const entries = ref([])
  const current = ref(null)      // live entry (endedAt:null) or null
  const elapsed = ref(0)         // seconds, ticked locally
  const todayTotalSec = ref(0)
  const loading = ref(false)
  const error = ref(null)
  let ticker = null
  let lastPausedId = null        // remembers the most-recently paused entry so Resume can revive it

  const isRunning = computed(() => !!current.value && !current.value.endedAt)
  const todayTotalFmt = computed(() => fmtTimer(todayTotalSec.value + (isRunning.value ? elapsed.value : 0)))

  function startTicker() {
    stopTicker()
    if (!current.value || current.value.endedAt) return
    const startMs = new Date(current.value.startedAt).getTime()
    elapsed.value = Math.max(0, Math.round((Date.now() - startMs) / 1000))
    ticker = setInterval(() => { elapsed.value++ }, 1000)
  }
  function stopTicker() { if (ticker) { clearInterval(ticker); ticker = null } }

  async function refresh() {
    loading.value = true; error.value = null
    try {
      const [entriesResp, totalResp] = await Promise.all([
        http.get('/api/time/entries'),
        http.get('/api/time/today-total'),
      ])
      entries.value = entriesResp.data.data
      todayTotalSec.value = totalResp.data.totalSec || 0
      current.value = entries.value.find((e) => !e.endedAt) || null
      if (current.value) startTicker(); else stopTicker()
    } catch (err) { error.value = err?.response?.data?.error?.message || err.message }
    finally { loading.value = false }
  }

  async function start({ taskId, subtaskId }) {
    const { data } = await http.post('/api/time/start', { taskId, subtaskId })
    current.value = data
    await refresh()
  }
  async function pause() {
    if (!current.value) return
    lastPausedId = current.value.id
    await http.post(`/api/time/${current.value.id}/pause`)
    await refresh()
  }
  async function resume() {
    const prevId = current.value?.id ?? lastPausedId ?? entries.value[0]?.id
    if (!prevId) return
    await http.post(`/api/time/${prevId}/resume`)
    lastPausedId = null
    await refresh()
  }
  async function stop() {
    if (!current.value) return
    await http.post(`/api/time/${current.value.id}/stop`)
    await refresh()
  }

  return { entries, current, elapsed, todayTotalSec, todayTotalFmt, loading, error, isRunning, refresh, start, pause, resume, stop }
})

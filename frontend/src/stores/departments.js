import { defineStore } from 'pinia'
import { ref } from 'vue'
import { http } from '@/lib/http'

export const useDepartmentsStore = defineStore('departments', () => {
  const list = ref([])
  const loading = ref(false)
  const error = ref(null)

  async function fetchList() {
    loading.value = true; error.value = null
    try {
      const { data } = await http.get('/api/departments', { params: { perPage: 100 } })
      list.value = data.data.map((d) => ({ id: String(d.id), name: d.name, description: d.description || '', headcount: d.headcount ?? 0 }))
    } catch (err) { error.value = err?.response?.data?.error?.message || err.message }
    finally { loading.value = false }
  }
  async function create(payload) {
    await http.post('/api/departments', payload)
    await fetchList()
  }
  async function update(id, payload) {
    await http.patch(`/api/departments/${id}`, payload)
    await fetchList()
  }
  async function remove(id) {
    await http.delete(`/api/departments/${id}`)
    await fetchList()
  }
  return { list, loading, error, fetchList, create, update, remove }
})

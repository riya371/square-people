import { defineStore } from 'pinia'
import { ref } from 'vue'
import { http } from '@/lib/http'

export const useRolesStore = defineStore('roles', () => {
  const list = ref([])
  const loading = ref(false)
  async function fetchList() {
    loading.value = true
    try {
      const { data } = await http.get('/api/roles', { params: { perPage: 100 } })
      list.value = data.data
    } finally { loading.value = false }
  }
  return { list, loading, fetchList }
})

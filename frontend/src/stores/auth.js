import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { http, setOnAuthError } from '@/lib/http'
import { roleAtLeast, hasCap } from '@/lib/permissions'

export const useAuthStore = defineStore('auth', () => {
  const user = ref(null)         // { id, email, role, companyId, employeeId, lastLoginAt }
  const company = ref(null)      // { id, slug, name, ... }
  const employee = ref(null)     // { id, name, email, phone, employeeCode, status, hireDate, ... }
  const permissions = ref([])
  const loading = ref(false)
  const error = ref(null)

  const signedIn = computed(() => !!user.value)
  const role = computed(() => user.value?.role || null)

  // Role/capability helpers — used to gate the UI. The API still enforces writes.
  function atLeast(minRole) { return roleAtLeast(role.value, minRole) }
  function can(cap) { return hasCap(role.value, cap) }

  const initials = computed(() => {
    const name = employee.value?.name || user.value?.email || ''
    if (!name) return '?'
    const parts = name.trim().split(/\s+/)
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  })

  async function fetchMe() {
    loading.value = true
    error.value = null
    try {
      const { data } = await http.get('/api/me')
      user.value = data.user
      company.value = data.company
      employee.value = data.employee
      permissions.value = data.permissions || []
      return data
    } catch (err) {
      if (err?.response?.status === 401) {
        user.value = null
        company.value = null
        employee.value = null
        permissions.value = []
        return null
      }
      error.value = err?.response?.data?.error?.message || err.message
      throw err
    } finally {
      loading.value = false
    }
  }

  async function login({ email, password, workspaceSlug }) {
    error.value = null
    try {
      await http.post('/api/auth/login', { email, password, workspaceSlug })
      await fetchMe()
      return { ok: true }
    } catch (err) {
      const code = err?.response?.data?.error?.code
      if (code === 'MULTIPLE_WORKSPACES') {
        return { ok: false, code, companies: err.response.data.error.details?.companies || [] }
      }
      error.value = err?.response?.data?.error?.message || err.message
      return { ok: false, code, message: error.value }
    }
  }

  async function employeeLogin({ companySlug, employeeCode, pin }) {
    error.value = null
    try {
      await http.post('/api/auth/employee-login', { companySlug, employeeCode, pin })
      await fetchMe()
      return { ok: true }
    } catch (err) {
      error.value = err?.response?.data?.error?.message || err.message
      return { ok: false, message: error.value }
    }
  }

  async function signup(payload) {
    error.value = null
    try {
      await http.post('/api/auth/signup', payload)
      await fetchMe()
      return { ok: true }
    } catch (err) {
      const code = err?.response?.data?.error?.code
      error.value = err?.response?.data?.error?.message || err.message
      return { ok: false, code, message: error.value, details: err.response?.data?.error?.details }
    }
  }

  async function logout() {
    try { await http.post('/api/auth/logout') } catch { /* ignore */ }
    user.value = null
    company.value = null
    employee.value = null
    permissions.value = []
  }

  async function forceLogout() {
    user.value = null
    company.value = null
    employee.value = null
    permissions.value = []
  }

  async function forgotPassword(email) {
    try {
      await http.post('/api/auth/forgot-password', { email })
      return { ok: true }
    } catch (err) {
      error.value = err?.response?.data?.error?.message || err.message
      return { ok: false, message: error.value }
    }
  }

  async function resetPassword({ token, newPassword }) {
    try {
      await http.post('/api/auth/reset-password', { token, newPassword })
      return { ok: true }
    } catch (err) {
      error.value = err?.response?.data?.error?.message || err.message
      return { ok: false, message: error.value }
    }
  }

  // Wire the http interceptor's auth-error handler to this store.
  setOnAuthError(() => { forceLogout() })

  return {
    user, company, employee, permissions, loading, error,
    signedIn, role, initials, atLeast, can,
    fetchMe, login, employeeLogin, signup, logout, forceLogout, forgotPassword, resetPassword,
  }
})

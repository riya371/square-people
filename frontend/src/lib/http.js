import axios from 'axios'

export const http = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
})

// Refresh-once-on-401 interceptor. The auth store imports `http` and also
// registers its `forceLogout` handler via `setOnAuthError`.
let onAuthError = null
export function setOnAuthError(fn) { onAuthError = fn }

let refreshInflight = null

http.interceptors.response.use(
  (resp) => resp,
  async (err) => {
    const status = err?.response?.status
    const original = err?.config
    if (status !== 401 || !original || original._retried) {
      return Promise.reject(err)
    }
    // Don't try to refresh from auth endpoints themselves.
    if (original.url?.includes('/api/auth/')) return Promise.reject(err)

    try {
      refreshInflight = refreshInflight || http.post('/api/auth/refresh').finally(() => { refreshInflight = null })
      await refreshInflight
      original._retried = true
      return http.request(original)
    } catch (_) {
      if (onAuthError) onAuthError()
      return Promise.reject(err)
    }
  },
)

import { storeToRefs } from 'pinia'
import { useAuthStore } from '@/stores/auth'

export function useSession() {
  const store = useAuthStore()
  const { user: storeUser, signedIn } = storeToRefs(store)

  // Existing components expect { name, role, initials } on `user`.
  // Synthesise that shape from the auth store's user + employee.
  const user = {
    get value() {
      if (!storeUser.value) return null
      const employeeName = store.employee?.name || storeUser.value.email || ''
      return {
        name: employeeName,
        role: storeUser.value.role,
        initials: store.initials,
      }
    },
  }

  return {
    user,
    signedIn,
    signIn: store.fetchMe,         // legacy callers will be replaced; this is a safe fallback
    signOut: store.logout,
  }
}

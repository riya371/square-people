<script setup>
import { ref, onMounted } from 'vue'
import { useRoute, useRouter, RouterLink } from 'vue-router'
import { KeyRound, ArrowRight } from '@lucide/vue'
import AuthLayout from '@/layouts/AuthLayout.vue'
import FormField from '@/components/auth/FormField.vue'
import { useAuthStore } from '@/stores/auth'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const token = ref('')
const newPassword = ref('')
const submitting = ref(false)
const error = ref('')
const done = ref(false)

onMounted(() => {
  token.value = String(route.query.token || '')
  if (!token.value) error.value = 'Missing reset token.'
})

async function submit() {
  if (submitting.value) return
  error.value = ''
  submitting.value = true
  const result = await auth.resetPassword({ token: token.value, newPassword: newPassword.value })
  submitting.value = false
  if (result.ok) {
    done.value = true
    setTimeout(() => router.push('/login'), 1500)
  } else {
    error.value = result.message || 'Reset failed.'
  }
}
</script>

<template>
  <AuthLayout>
    <template #brand-top>
      <h2 class="text-3xl font-bold leading-tight mb-3">Set a new password.</h2>
      <p class="text-white/80 text-sm leading-relaxed max-w-sm">Almost there — pick something memorable.</p>
    </template>

    <div class="w-12 h-12 rounded-xl bg-brand-100 flex items-center justify-center mb-5">
      <KeyRound class="w-6 h-6 text-brand-700" />
    </div>
    <h1 class="text-2xl font-bold mb-2">Reset your password</h1>
    <p class="text-sm text-ink-500 mb-8">Enter a new password below.</p>

    <form class="space-y-4" @submit.prevent="submit">
      <FormField label="New password" for="np">
        <input id="np" v-model="newPassword" type="password" minlength="8" required
          class="w-full px-3 py-2.5 rounded-md border border-cream-300 bg-white text-sm focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20" />
      </FormField>
      <p v-if="error" class="text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded-md px-3 py-2">{{ error }}</p>
      <p v-if="done" class="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-md px-3 py-2">
        Password updated. Redirecting to sign in…
      </p>
      <button type="submit" :disabled="submitting || !token"
        class="w-full px-4 py-2.5 rounded-md bg-brand-500 hover:bg-brand-600 disabled:opacity-60 text-white text-sm font-semibold flex items-center justify-center gap-2 transition">
        {{ submitting ? 'Updating…' : 'Update password' }}
        <ArrowRight class="w-4 h-4" />
      </button>
    </form>

    <p class="text-sm text-ink-500 text-center mt-8">
      Remembered it?
      <RouterLink to="/login" class="text-brand-700 hover:text-brand-800 font-semibold">Sign in</RouterLink>
    </p>
  </AuthLayout>
</template>

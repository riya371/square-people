<script setup>
import FormField from '@/components/auth/FormField.vue'
import AuthLayout from '@/layouts/AuthLayout.vue'
import { ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const auth = useAuthStore()
const companySlug = ref('')
const employeeCode = ref('')
const pin = ref('')
const submitting = ref(false)
const formError = ref('')

async function handleLogin() {
  if (submitting.value) return
  formError.value = ''
  const slug = companySlug.value.trim().toLowerCase()
  const code = employeeCode.value.trim()
  const pinTrim = pin.value.trim()
  if (!slug || !code || !pinTrim) {
    formError.value = 'Please fill in all three fields.'
    return
  }
  if (!/^\d{4}$/.test(pinTrim)) {
    formError.value = 'PIN must be exactly 4 digits.'
    return
  }
  submitting.value = true
  const result = await auth.employeeLogin({ companySlug: slug, employeeCode: code, pin: pinTrim })
  submitting.value = false
  if (result.ok) {
    router.push('/app/attendance')
  } else {
    const apiMsg = result.message || ''
    formError.value = /invalid credentials/i.test(apiMsg)
      ? 'Wrong workspace, employee ID or PIN. Double-check each field, or ask your admin to confirm your employee code.'
      : (apiMsg || 'Sign in failed.')
  }
}
</script>

<template>
  <AuthLayout>
    <template #brand-top>
      <h2 class="text-3xl font-bold leading-tight mb-3">
        The simplest way to <br/>track your shift.
      </h2>
      <p class="text-white/80 text-sm leading-relaxed max-w-sm">
        Authorized personnel only. Access your tasks, schedule, and clock-in tools.
      </p>
    </template>

    <template #brand-card>
      <div class="relative z-10 bg-white/10 backdrop-blur-sm border border-white/15 rounded-xl p-5">
        <div class="flex items-center gap-2 mb-2 text-brand-300">
          <span class="text-xs font-bold uppercase tracking-widest">Notice</span>
        </div>
        <p class="text-sm leading-relaxed">
          Please ensure your location services are enabled before clocking in for accurate shift tracking.
        </p>
      </div>
    </template>

    <div class="w-full">
      <h1 class="text-2xl font-bold mb-2">Employee Sign In</h1>
      <p class="text-sm text-ink-500 mb-8">Enter your ID and PIN to continue.</p>

      <form @submit.prevent="handleLogin" class="space-y-4">
        <FormField label="Workspace URL" for="emp-company-slug" helper="The part before .squarepeople.app">
          <input id="emp-company-slug" v-model="companySlug" type="text" placeholder="square-feet" required
            class="w-full px-3 py-2.5 rounded-md border border-cream-300 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none" />
        </FormField>
        <FormField label="Employee ID" for="emp-id">
          <input id="emp-id" v-model="employeeCode" type="text" placeholder="EMP-12345" required
            class="w-full px-3 py-2.5 rounded-md border border-cream-300 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none" />
        </FormField>
        <FormField label="Access PIN" for="emp-pin" helper="4-digit PIN">
          <input id="emp-pin" v-model="pin" type="password" inputmode="numeric" maxlength="4" placeholder="••••" required
            class="w-full px-3 py-2.5 rounded-md border border-cream-300 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none" />
        </FormField>
        <p v-if="formError" class="text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded-md px-3 py-2">{{ formError }}</p>
        <button type="submit" :disabled="submitting"
          class="w-full px-4 py-2.5 rounded-md bg-brand-500 hover:bg-brand-600 disabled:opacity-60 text-white text-sm font-semibold transition">
          {{ submitting ? 'Signing in…' : 'Sign In' }}
        </button>
      </form>
      <p class="text-sm text-ink-500 text-center mt-6">
        Are you an admin or owner?
        <RouterLink to="/login" class="text-brand-700 hover:text-brand-800 font-semibold">Use email sign in</RouterLink>
      </p>
    </div>
  </AuthLayout>
</template>
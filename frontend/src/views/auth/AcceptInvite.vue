<script setup>
import { ref, onMounted } from 'vue'
import { useRoute, useRouter, RouterLink } from 'vue-router'
import { CheckCircle2, ArrowRight, AlertTriangle } from '@lucide/vue'
import AuthLayout from '@/layouts/AuthLayout.vue'
import FormField from '@/components/auth/FormField.vue'
import { http } from '@/lib/http'
import { useAuthStore } from '@/stores/auth'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()

const token = ref('')
const status = ref('loading')   // loading | pending | accepted | expired | error
const invite = ref(null)
const fullName = ref('')
const password = ref('')
const pin = ref('')
const submitting = ref(false)
const error = ref('')

onMounted(async () => {
  token.value = String(route.query.token || '')
  if (!token.value) { status.value = 'error'; error.value = 'Missing invite token.'; return }
  try {
    const { data } = await http.get('/api/invites/accept', { params: { token: token.value } })
    status.value = data.status
    invite.value = data.invite || null
  } catch {
    status.value = 'error'
    error.value = 'Invite not found.'
  }
})

async function accept() {
  if (submitting.value) return
  error.value = ''
  submitting.value = true
  try {
    await http.post('/api/invites/accept', {
      token: token.value,
      fullName: fullName.value,
      password: password.value,
      pin: pin.value || undefined,
    })
    await auth.fetchMe()
    router.push('/app/dashboard')
  } catch (err) {
    error.value = err?.response?.data?.error?.message || 'Could not accept invite.'
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <AuthLayout>
    <template #brand-top>
      <h2 class="text-3xl font-bold leading-tight mb-3">Welcome aboard.</h2>
      <p class="text-white/80 text-sm leading-relaxed max-w-sm">
        Accept your invite to start using SquarePeople with your team.
      </p>
    </template>

    <div v-if="status === 'loading'" class="text-sm text-ink-500">Loading invite…</div>

    <div v-else-if="status === 'accepted'" class="rounded-md border border-emerald-200 bg-emerald-50 p-4 text-sm flex items-start gap-2">
      <CheckCircle2 class="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
      <div>This invite was already accepted. <RouterLink to="/login" class="text-brand-700 font-semibold">Sign in</RouterLink>.</div>
    </div>

    <div v-else-if="status === 'expired'" class="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm flex items-start gap-2">
      <AlertTriangle class="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
      <div>This invite expired. Ask your admin to send a new one.</div>
    </div>

    <div v-else-if="status === 'error'" class="rounded-md border border-rose-200 bg-rose-50 p-4 text-sm">{{ error }}</div>

    <div v-else-if="status === 'pending'">
      <h1 class="text-2xl font-bold mb-2">Join {{ invite?.companyName }}</h1>
      <p class="text-sm text-ink-500 mb-8">
        You were invited as <strong>{{ invite?.role }}</strong> to <strong>{{ invite?.companyName }}</strong>.
      </p>
      <form class="space-y-4" @submit.prevent="accept">
        <FormField label="Full name" for="ai-name">
          <input id="ai-name" v-model="fullName" type="text" required
            class="w-full px-3 py-2.5 rounded-md border border-cream-300 bg-white text-sm focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20" />
        </FormField>
        <FormField label="Password" for="ai-pw" helper="At least 8 characters">
          <input id="ai-pw" v-model="password" type="password" minlength="8" required
            class="w-full px-3 py-2.5 rounded-md border border-cream-300 bg-white text-sm focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20" />
        </FormField>
        <FormField label="Kiosk PIN" for="ai-pin" helper="Optional. 4 digits for kiosk sign-in.">
          <input id="ai-pin" v-model="pin" type="text" inputmode="numeric" maxlength="4" pattern="\d{4}"
            class="w-full px-3 py-2.5 rounded-md border border-cream-300 bg-white text-sm focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20" />
        </FormField>
        <p v-if="error" class="text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded-md px-3 py-2">{{ error }}</p>
        <button type="submit" :disabled="submitting"
          class="w-full px-4 py-2.5 rounded-md bg-brand-500 hover:bg-brand-600 disabled:opacity-60 text-white text-sm font-semibold flex items-center justify-center gap-2">
          {{ submitting ? 'Accepting…' : 'Accept invite' }}
          <ArrowRight class="w-4 h-4" />
        </button>
      </form>
    </div>
  </AuthLayout>
</template>

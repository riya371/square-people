<script setup>
import { ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ShieldCheck, ArrowRight, ArrowLeft, Check, X } from '@lucide/vue'
import AuthLayout from '@/layouts/AuthLayout.vue'
import FormField from '@/components/auth/FormField.vue'
import StepIndicator from '@/components/auth/StepIndicator.vue'
import WorkdaysPicker from '@/components/auth/WorkdaysPicker.vue'
import WorkspaceUrlInput from '@/components/auth/WorkspaceUrlInput.vue'
import { useSignupFlow } from '@/composables/useSignupFlow.js'
import { useAuthStore } from '@/stores/auth'
import { http } from '@/lib/http'

const router = useRouter()
const auth = useAuthStore()
const flow = useSignupFlow()

const sizeOptions = ['1–10', '11–50', '51–200', '201–500', '500+']
const industryOptions = ['Technology', 'Marketing & Agency', 'Finance', 'Healthcare', 'Retail', 'Other']

const slugAvailable = ref(null)   // null = unchecked, true/false = result
const slugChecking = ref(false)
let slugTimer = null

watch(() => flow.workspaceUrl, (slug) => {
  slugAvailable.value = null
  if (slugTimer) clearTimeout(slugTimer)
  if (!slug || slug.length < 2) return
  slugChecking.value = true
  slugTimer = setTimeout(async () => {
    try {
      const { data } = await http.get('/api/companies/me/workspace-check', { params: { slug } })
      slugAvailable.value = !!data.available
    } catch {
      slugAvailable.value = null
    } finally {
      slugChecking.value = false
    }
  }, 400)
})

const submitting = ref(false)
const formError = ref('')

function back() { router.push('/signup') }

async function createWorkspace() {
  if (submitting.value) return
  formError.value = ''
  if (slugAvailable.value === false) {
    formError.value = 'That workspace URL is taken. Pick a different one.'
    return
  }
  submitting.value = true
  const result = await auth.signup({
    fullName: flow.fullName,
    email: flow.email,
    password: flow.password,
    companyName: flow.companyName,
    workspaceSlug: flow.workspaceUrl,
    companySize: flow.companySize,
    industry: flow.industry,
    workdays: flow.workdays,
  })
  submitting.value = false
  if (result.ok) {
    router.push('/app/dashboard')
  } else {
    formError.value = result.message || 'Signup failed.'
  }
}
</script>

<template>
  <AuthLayout>
    <template #brand-top>
      <h2 class="text-3xl font-bold leading-tight mb-3">Set up your company workspace.</h2>
      <p class="text-white/80 text-sm leading-relaxed max-w-sm mb-10">
        This is the workspace your team will join. You can change anything later from Settings.
      </p>
      <div class="bg-white/10 backdrop-blur-sm border border-white/15 rounded-xl p-5">
        <div class="flex items-center gap-3 mb-2">
          <ShieldCheck class="w-5 h-5 text-brand-300" />
          <span class="font-semibold text-sm">Your data is yours</span>
        </div>
        <p class="text-xs text-white/80 leading-relaxed">
          Each company workspace is isolated. Other companies on SquarePeople can never see your employees, projects, or attendance.
        </p>
      </div>
    </template>

    <StepIndicator :current="2" />

    <h1 class="text-2xl font-bold mb-2">Tell us about your company</h1>
    <p class="text-sm text-ink-500 mb-8">We'll use this to set up your workspace.</p>

    <form class="space-y-4" @submit.prevent="createWorkspace">
      <FormField label="Company name" for="company-name">
        <input
          id="company-name"
          v-model="flow.companyName"
          type="text"
          placeholder="Square Feet LTD"
          class="w-full px-3 py-2.5 rounded-md border border-cream-300 bg-white text-sm focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
        />
      </FormField>

      <FormField label="Workspace URL" for="workspace-url">
        <WorkspaceUrlInput v-model="flow.workspaceUrl" id="workspace-url" />
        <div class="text-xs mt-1.5">
          <span v-if="slugChecking" class="text-ink-500">Checking availability…</span>
          <span v-else-if="slugAvailable === true" class="text-emerald-600 inline-flex items-center gap-1"><Check class="w-3.5 h-3.5" />Available</span>
          <span v-else-if="slugAvailable === false" class="text-rose-600 inline-flex items-center gap-1"><X class="w-3.5 h-3.5" />Taken — pick another</span>
        </div>
      </FormField>

      <div class="grid grid-cols-2 gap-4">
        <FormField label="Company size" for="company-size">
          <select
            id="company-size"
            v-model="flow.companySize"
            class="w-full px-3 py-2.5 rounded-md border border-cream-300 bg-white text-sm focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
          >
            <option v-for="opt in sizeOptions" :key="opt" :value="opt">{{ opt }}</option>
          </select>
        </FormField>

        <FormField label="Industry" for="industry">
          <select
            id="industry"
            v-model="flow.industry"
            class="w-full px-3 py-2.5 rounded-md border border-cream-300 bg-white text-sm focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
          >
            <option v-for="opt in industryOptions" :key="opt" :value="opt">{{ opt }}</option>
          </select>
        </FormField>
      </div>

      <FormField label="Working days">
        <WorkdaysPicker v-model="flow.workdays" />
      </FormField>

      <p v-if="formError" class="text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded-md px-3 py-2">{{ formError }}</p>

      <div class="flex gap-3 pt-2">
        <button
          type="button"
          @click="back"
          class="px-4 py-2.5 rounded-md border border-cream-300 bg-white hover:bg-cream-100 text-sm font-semibold flex items-center gap-2 transition-colors"
        >
          <ArrowLeft class="w-4 h-4" />
          Back
        </button>
        <button
          type="submit"
          :disabled="submitting"
          class="flex-1 px-4 py-2.5 rounded-md bg-brand-500 hover:bg-brand-600 disabled:opacity-60 text-white text-sm font-semibold flex items-center justify-center gap-2 transition"
        >
          {{ submitting ? 'Creating…' : 'Create workspace' }}
          <ArrowRight class="w-4 h-4" />
        </button>
      </div>
    </form>
  </AuthLayout>
</template>

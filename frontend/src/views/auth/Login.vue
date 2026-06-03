<script setup>
import { ref, computed, watch } from 'vue'
import { RouterLink, useRouter, useRoute } from 'vue-router'
import { Cookie, Star, ArrowRight, Mail, KeyRound } from '@lucide/vue'
import AuthLayout from '@/layouts/AuthLayout.vue'
import FormField from '@/components/auth/FormField.vue'
import PasswordField from '@/components/auth/PasswordField.vue'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const route = useRoute()
const auth = useAuthStore()

const mode = ref(route.query.mode === 'pin' ? 'pin' : 'email')
watch(() => route.query.mode, (m) => { mode.value = m === 'pin' ? 'pin' : 'email' })

function switchTo(m) {
  mode.value = m
  router.replace({ query: { ...route.query, mode: m === 'pin' ? 'pin' : undefined } })
  formError.value = ''
  conflict.value = null
}

// --- Shared state ---
const submitting = ref(false)
const formError = ref('')

// --- Email + password ---
const email = ref('')
const password = ref('')
const emailWorkspaceSlug = ref('')
const showEmailWorkspace = ref(false)
const conflict = ref(null)

async function signInWithEmail() {
  if (submitting.value) return
  formError.value = ''
  conflict.value = null
  submitting.value = true
  const result = await auth.login({
    email: email.value.trim(),
    password: password.value,
    workspaceSlug: emailWorkspaceSlug.value.trim().toLowerCase() || undefined,
  })
  submitting.value = false
  if (result.ok) {
    router.push(route.query.from || '/app/dashboard')
    return
  }
  if (result.code === 'MULTIPLE_WORKSPACES') {
    conflict.value = { companies: result.companies }
    showEmailWorkspace.value = true
    return
  }
  formError.value = result.message || 'Sign in failed.'
}

function chooseWorkspace(slug) {
  emailWorkspaceSlug.value = slug
  conflict.value = null
  signInWithEmail()
}

// --- Workspace + employee code + PIN ---
const pinWorkspaceSlug = ref('')
const employeeCode = ref('')
const pin = ref('')

async function signInWithPin() {
  if (submitting.value) return
  formError.value = ''
  const slug = pinWorkspaceSlug.value.trim().toLowerCase()
  const code = employeeCode.value.trim()
  const pinVal = pin.value.trim()
  if (!slug || !code || !pinVal) {
    formError.value = 'Please fill in all three fields.'
    return
  }
  if (!/^\d{4}$/.test(pinVal)) {
    formError.value = 'PIN must be exactly 4 digits.'
    return
  }
  submitting.value = true
  const result = await auth.employeeLogin({ companySlug: slug, employeeCode: code, pin: pinVal })
  submitting.value = false
  if (result.ok) {
    router.push(route.query.from || '/app/attendance')
    return
  }
  const apiMsg = result.message || ''
  formError.value = /invalid credentials/i.test(apiMsg)
    ? 'Wrong workspace, employee ID or PIN. Double-check each field, or ask your admin to confirm your employee code.'
    : (apiMsg || 'Sign in failed.')
}
</script>

<template>
  <AuthLayout>
    <template #brand-top>
      <h2 class="text-3xl font-bold leading-tight mb-3">
        Your team, your time,<br />your tools — in one place.
      </h2>
      <p class="text-white/80 text-sm leading-relaxed max-w-sm">
        Track attendance, manage projects, and keep your people happy. SquarePeople gives modern teams an end-to-end view of their workforce.
      </p>
    </template>

    <template #brand-card>
      <div class="relative z-10 bg-white/10 backdrop-blur-sm border border-white/15 rounded-xl p-5">
        <div class="flex items-center gap-1 mb-3 text-brand-300">
          <Star v-for="i in 5" :key="i" class="w-4 h-4 fill-current" />
        </div>
        <p class="text-sm leading-relaxed mb-4">
          "We replaced four tools with SquarePeople in a week. Our managers stopped chasing leave forms and started running their teams."
        </p>
        <div class="flex items-center gap-3">
          <div class="w-9 h-9 rounded-full bg-gradient-to-br from-brand-400 to-accent-500 flex items-center justify-center text-white text-sm font-semibold">
            PR
          </div>
          <div>
            <div class="text-sm font-semibold">Priya Raman</div>
            <div class="text-xs text-white/70">Head of People · Acme Co.</div>
          </div>
        </div>
      </div>
    </template>

    <div class="lg:hidden flex items-center gap-3 mb-10">
      <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-500 to-accent-500 flex items-center justify-center">
        <Cookie class="w-5 h-5 text-white" />
      </div>
      <div class="leading-tight">
        <div class="font-bold">SquarePeople</div>
        <div class="text-[10px] uppercase tracking-wider text-ink-500">by Square Feet</div>
      </div>
    </div>

    <h1 class="text-2xl font-bold mb-2">Welcome back</h1>
    <p class="text-sm text-ink-500 mb-6">Sign in to your SquarePeople workspace.</p>

    <!-- Tab switcher -->
    <div class="flex gap-1 p-1 bg-cream-100 rounded-md mb-6 text-sm">
      <button
        type="button"
        @click="switchTo('email')"
        :class="['flex-1 px-3 py-1.5 rounded transition flex items-center justify-center gap-1.5 font-medium', mode === 'email' ? 'bg-white shadow-sm text-ink-900' : 'text-ink-500 hover:text-ink-700']"
      >
        <Mail class="w-4 h-4" /> Email
      </button>
      <button
        type="button"
        @click="switchTo('pin')"
        :class="['flex-1 px-3 py-1.5 rounded transition flex items-center justify-center gap-1.5 font-medium', mode === 'pin' ? 'bg-white shadow-sm text-ink-900' : 'text-ink-500 hover:text-ink-700']"
      >
        <KeyRound class="w-4 h-4" /> Employee PIN
      </button>
    </div>

    <!-- Email + password form -->
    <form v-if="mode === 'email'" class="space-y-4" @submit.prevent="signInWithEmail">
      <FormField label="Work email" for="login-email">
        <input
          id="login-email"
          v-model="email"
          type="email"
          placeholder="you@squarefeet.com"
          class="w-full px-3 py-2.5 rounded-md border border-cream-300 bg-white text-sm focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
        />
      </FormField>

      <PasswordField id="login-password" v-model="password">
        <template #action>
          <RouterLink to="/forgot-password" class="text-xs text-brand-700 hover:text-brand-800 font-medium">
            Forgot password?
          </RouterLink>
        </template>
      </PasswordField>

      <FormField v-if="showEmailWorkspace || emailWorkspaceSlug" label="Workspace URL" for="login-workspace" helper="The part before .squarepeople.app, or leave blank.">
        <input id="login-workspace" v-model="emailWorkspaceSlug" type="text" placeholder="square-feet"
          class="w-full px-3 py-2.5 rounded-md border border-cream-300 bg-white text-sm focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20" />
      </FormField>
      <button v-else type="button" class="text-xs text-ink-500 hover:text-ink-900" @click="showEmailWorkspace = true">
        Use a specific workspace
      </button>

      <p v-if="formError" class="text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded-md px-3 py-2">{{ formError }}</p>

      <div v-if="conflict" class="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm">
        <div class="mb-2 font-medium text-amber-900">That email is in multiple workspaces. Pick one:</div>
        <ul class="space-y-1">
          <li v-for="c in conflict.companies" :key="c.slug">
            <button type="button" class="text-brand-700 hover:text-brand-800 font-medium underline" @click="chooseWorkspace(c.slug)">{{ c.name }} <span class="text-xs text-ink-500">({{ c.slug }})</span></button>
          </li>
        </ul>
      </div>

      <button type="submit" :disabled="submitting"
        class="w-full px-4 py-2.5 rounded-md bg-brand-500 hover:bg-brand-600 disabled:opacity-60 text-white text-sm font-semibold transition flex items-center justify-center gap-2">
        {{ submitting ? 'Signing in…' : 'Sign in' }}
        <ArrowRight class="w-4 h-4" />
      </button>
    </form>

    <!-- Employee PIN form -->
    <form v-else class="space-y-4" @submit.prevent="signInWithPin">
      <FormField label="Workspace URL" for="pin-workspace" helper="The part before .squarepeople.app. Ask your admin if you're unsure.">
        <input id="pin-workspace" v-model="pinWorkspaceSlug" type="text" placeholder="square-feet" required autocomplete="off"
          class="w-full px-3 py-2.5 rounded-md border border-cream-300 bg-white text-sm focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20" />
      </FormField>
      <FormField label="Employee ID" for="pin-emp-id" helper="Set by your admin (e.g. EMP-0007).">
        <input id="pin-emp-id" v-model="employeeCode" type="text" placeholder="EMP-0007" required autocomplete="off"
          class="w-full px-3 py-2.5 rounded-md border border-cream-300 bg-white text-sm focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20" />
      </FormField>
      <FormField label="Access PIN" for="pin-pin" helper="4-digit PIN you set when accepting your invite.">
        <input id="pin-pin" v-model="pin" type="password" inputmode="numeric" maxlength="4" placeholder="••••" required autocomplete="off"
          class="w-full px-3 py-2.5 rounded-md border border-cream-300 bg-white text-sm focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20" />
      </FormField>

      <p v-if="formError" class="text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded-md px-3 py-2">{{ formError }}</p>

      <button type="submit" :disabled="submitting"
        class="w-full px-4 py-2.5 rounded-md bg-brand-500 hover:bg-brand-600 disabled:opacity-60 text-white text-sm font-semibold transition flex items-center justify-center gap-2">
        {{ submitting ? 'Signing in…' : 'Sign in' }}
        <ArrowRight class="w-4 h-4" />
      </button>
    </form>

    <p class="text-sm text-ink-500 text-center mt-8">
      New to SquarePeople?
      <RouterLink to="/signup" class="text-brand-700 hover:text-brand-800 font-semibold">
        Create an account
      </RouterLink>
    </p>
  </AuthLayout>
</template>

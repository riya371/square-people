<script setup>
import { ref } from 'vue'
import { RouterLink } from 'vue-router'
import { ArrowLeft, KeyRound, Send } from '@lucide/vue'
import AuthLayout from '@/layouts/AuthLayout.vue'
import FormField from '@/components/auth/FormField.vue'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const email = ref('')
const sent = ref(false)
const submitting = ref(false)

async function sendReset() {
  if (submitting.value) return
  submitting.value = true
  await auth.forgotPassword(email.value)
  submitting.value = false
  sent.value = true
}
</script>

<template>
  <AuthLayout>
    <template #brand-top>
      <h2 class="text-4xl font-italic leading-tight mb-3">
        Locked out?<br />It happens to the best of us.
      </h2>
      <p class="text-blue/80 text-sm leading-relaxed max-w-sm">
        Enter your work email and we'll send you a reset link. The link expires in 30 minutes.
      </p>
    </template>

    <RouterLink
      to="/login"
      class="inline-flex items-center gap-1.5 text-sm text-ink-500 hover:text-ink-900 mb-8"
    >
      <ArrowLeft class="w-4 h-4" />
      Back to sign in
    </RouterLink>

    <div class="w-12 h-12 rounded-xl bg-brand-100 flex items-center justify-center mb-5">
      <KeyRound class="w-6 h-6 text-brand-700" />
    </div>
    <h1 class="text-2xl font-bold mb-2">Reset your password</h1>
    <p class="text-sm text-ink-500 mb-8">
      Enter the email tied to your SquarePeople account and we'll send you a reset link.
    </p>

    <form class="space-y-4" @submit.prevent="sendReset">
      <FormField label="Work email" for="forgot-email">
        <input
          id="forgot-email"
          v-model="email"
          type="email"
          placeholder="you@yourcompany.com"
          class="w-full px-3 py-2.5 rounded-md border border-cream-300 bg-white text-sm focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
        />
      </FormField>
      <button
        type="submit"
        class="w-full px-4 py-2.5 rounded-md bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold flex items-center justify-center gap-2 transition"
      >
        Send reset link
        <Send class="w-4 h-4" />
      </button>
    </form>

    <div v-if="sent" class="mt-6 p-4 bg-emerald-50 border border-emerald-200 rounded-md text-sm">
      If an account exists for <strong>{{ email }}</strong>, we sent a reset link. Check your inbox.
    </div>

    <div class="mt-8 pt-6 border-t border-cream-200">
      <p class="text-sm text-ink-500">
        Don't have an account?
        <RouterLink to="/signup" class="text-brand-700 hover:text-brand-800 font-semibold">
          Create one
        </RouterLink>
      </p>
    </div>
  </AuthLayout>
</template>

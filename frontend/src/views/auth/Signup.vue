<script setup>
import { RouterLink, useRouter } from 'vue-router'
import { CheckCircle2, ArrowRight } from '@lucide/vue'
import AuthLayout from '@/layouts/AuthLayout.vue'
import FormField from '@/components/auth/FormField.vue'
import StepIndicator from '@/components/auth/StepIndicator.vue'
import PasswordStrength from '@/components/auth/PasswordStrength.vue'
import { useSignupFlow } from '@/composables/useSignupFlow.js'

const router = useRouter()
const flow = useSignupFlow()

const benefits = [
  'Unlimited employees during trial',
  'Attendance, leaves, time tracking, projects — all included',
  'Cancel anytime. Export your data on the way out.',
  'Backed by Square Feet support',
]

function next() {
  router.push('/signup/company')
}
</script>

<template>
  <AuthLayout>
    <template #brand-top>
      <h2 class="text-3xl font-bold leading-tight mb-3">Start your 14-day free trial.</h2>
      <p class="text-white/80 text-sm leading-relaxed max-w-sm mb-10">
        No credit card required. Get your whole company running in under 10 minutes.
      </p>

      <ul class="space-y-3 text-sm">
        <li v-for="b in benefits" :key="b" class="flex items-start gap-3">
          <CheckCircle2 class="w-5 h-5 text-brand-300 flex-shrink-0 mt-0.5" />
          <span>{{ b }}</span>
        </li>
      </ul>
    </template>

    <StepIndicator :current="1" />

    <h1 class="text-2xl font-bold mb-2">Create your account</h1>
    <p class="text-sm text-ink-500 mb-8">
      Already have one?
      <RouterLink to="/login" class="text-brand-700 hover:text-brand-800 font-semibold">Sign in</RouterLink>
    </p>

    <form class="space-y-4" @submit.prevent="next">
      <FormField label="Full name" for="signup-name">
        <input
          id="signup-name"
          v-model="flow.fullName"
          type="text"
          placeholder="Riya Ghosh"
          class="w-full px-3 py-2.5 rounded-md border border-cream-300 bg-white text-sm focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
        />
      </FormField>

      <FormField
        label="Work email"
        for="signup-email"
        helper="Use a work email so your teammates can find you."
      >
        <input
          id="signup-email"
          v-model="flow.email"
          type="email"
          placeholder="you@yourcompany.com"
          class="w-full px-3 py-2.5 rounded-md border border-cream-300 bg-white text-sm focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
        />
      </FormField>

      <div>
        <label
          for="signup-password"
          class="block text-xs font-semibold text-ink-600 uppercase tracking-wide mb-1.5"
        >Password</label>
        <input
          id="signup-password"
          v-model="flow.password"
          type="password"
          placeholder="At least 8 characters"
          class="w-full px-3 py-2.5 rounded-md border border-cream-300 bg-white text-sm focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
        />
        <PasswordStrength :password="flow.password" />
      </div>

      <label class="flex items-start gap-2 text-xs text-ink-500 leading-relaxed">
        <input
          v-model="flow.agreedToTerms"
          type="checkbox"
          class="w-4 h-4 rounded border-cream-300 text-brand-500 focus:ring-brand-500 mt-0.5"
        />
        <span>
          I agree to the
          <a href="#" class="text-brand-700 font-medium">Terms</a>
          and
          <a href="#" class="text-brand-700 font-medium">Privacy Policy</a>.
        </span>
      </label>

      <button
        type="submit"
        class="w-full px-4 py-2.5 rounded-md bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold flex items-center justify-center gap-2 transition"
      >
        Continue
        <ArrowRight class="w-4 h-4" />
      </button>
    </form>
  </AuthLayout>
</template>

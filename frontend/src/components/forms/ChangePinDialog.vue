<script setup>
import { ref, watch } from 'vue'
import Dialog from '@/components/ui/Dialog.vue'
import { http } from '@/lib/http'

const props = defineProps({
  open: { type: Boolean, default: false },
})
const emit = defineEmits(['update:open', 'saved'])

const mode = ref('password') // 'password' | 'pin'
const currentPassword = ref('')
const currentPin = ref('')
const newPin = ref('')
const newPinConfirm = ref('')
const submitting = ref(false)
const error = ref('')
const success = ref(false)

function reset() {
  mode.value = 'password'
  currentPassword.value = ''
  currentPin.value = ''
  newPin.value = ''
  newPinConfirm.value = ''
  submitting.value = false
  error.value = ''
  success.value = false
}

watch(() => props.open, (v) => { if (v) reset() })

async function submit() {
  if (submitting.value) return
  error.value = ''
  success.value = false
  if (!/^\d{4}$/.test(newPin.value)) {
    error.value = 'New PIN must be exactly 4 digits.'
    return
  }
  if (newPin.value !== newPinConfirm.value) {
    error.value = 'New PIN entries do not match.'
    return
  }
  const payload = { pin: newPin.value }
  if (mode.value === 'password') {
    if (!currentPassword.value) { error.value = 'Enter your current password.'; return }
    payload.currentPassword = currentPassword.value
  } else {
    if (!/^\d{4}$/.test(currentPin.value)) { error.value = 'Current PIN must be 4 digits.'; return }
    payload.currentPin = currentPin.value
  }
  submitting.value = true
  try {
    await http.post('/api/me/set-pin', payload)
    success.value = true
    emit('saved')
    setTimeout(() => emit('update:open', false), 1200)
  } catch (err) {
    error.value = err?.response?.data?.error?.message || err.message || 'Failed to update PIN.'
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <Dialog :open="open" title="Change PIN" size="sm" @update:open="(v) => emit('update:open', v)">
    <form @submit.prevent="submit" class="space-y-3">
      <p class="text-xs text-ink-500">
        Your PIN is used for kiosk sign-in. It must be exactly 4 digits.
      </p>

      <div class="flex gap-1 p-1 bg-cream-100 rounded-md text-xs">
        <button
          type="button"
          :class="['flex-1 px-2 py-1 rounded transition', mode === 'password' ? 'bg-white shadow-sm font-medium text-ink-900' : 'text-ink-500 hover:text-ink-700']"
          @click="mode = 'password'"
        >Confirm with password</button>
        <button
          type="button"
          :class="['flex-1 px-2 py-1 rounded transition', mode === 'pin' ? 'bg-white shadow-sm font-medium text-ink-900' : 'text-ink-500 hover:text-ink-700']"
          @click="mode = 'pin'"
        >Confirm with current PIN</button>
      </div>

      <div v-if="mode === 'password'">
        <label class="block text-xs font-medium text-ink-700 mb-1">Current password</label>
        <input
          v-model="currentPassword"
          type="password"
          autocomplete="current-password"
          class="w-full px-3 py-2 rounded-md border border-cream-300 bg-white text-sm focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
        />
      </div>
      <div v-else>
        <label class="block text-xs font-medium text-ink-700 mb-1">Current PIN</label>
        <input
          v-model="currentPin"
          type="password"
          inputmode="numeric"
          maxlength="4"
          autocomplete="off"
          placeholder="••••"
          class="w-full px-3 py-2 rounded-md border border-cream-300 bg-white text-sm focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
        />
      </div>

      <div>
        <label class="block text-xs font-medium text-ink-700 mb-1">New PIN</label>
        <input
          v-model="newPin"
          type="password"
          inputmode="numeric"
          maxlength="4"
          autocomplete="new-password"
          placeholder="••••"
          class="w-full px-3 py-2 rounded-md border border-cream-300 bg-white text-sm focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
        />
      </div>
      <div>
        <label class="block text-xs font-medium text-ink-700 mb-1">Confirm new PIN</label>
        <input
          v-model="newPinConfirm"
          type="password"
          inputmode="numeric"
          maxlength="4"
          autocomplete="new-password"
          placeholder="••••"
          class="w-full px-3 py-2 rounded-md border border-cream-300 bg-white text-sm focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
        />
      </div>

      <div v-if="error" class="p-2.5 rounded-md bg-rose-50 border border-rose-200 text-xs text-rose-700">{{ error }}</div>
      <div v-if="success" class="p-2.5 rounded-md bg-emerald-50 border border-emerald-200 text-xs text-emerald-700">PIN updated successfully.</div>
    </form>

    <template #footer>
      <button type="button" @click="emit('update:open', false)" class="px-3 py-1.5 rounded-md border border-cream-300 hover:bg-cream-50 text-sm">Cancel</button>
      <button type="button" @click="submit" :disabled="submitting" class="px-3 py-1.5 rounded-md bg-brand-500 hover:bg-brand-600 disabled:opacity-60 text-white text-sm font-semibold">{{ submitting ? 'Saving…' : 'Update PIN' }}</button>
    </template>
  </Dialog>
</template>

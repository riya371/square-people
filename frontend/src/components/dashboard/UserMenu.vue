<script setup>
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import { Settings, LogOut, KeyRound, Copy, Check } from '@lucide/vue'
import { useSession } from '@/composables/useSession.js'
import { useAuthStore } from '@/stores/auth'
import ChangePinDialog from '@/components/forms/ChangePinDialog.vue'

const { user, signOut } = useSession()
const authStore = useAuthStore()
const { company } = storeToRefs(authStore)
const router = useRouter()
const open = ref(false)
const pinDialogOpen = ref(false)
const copied = ref(false)

const initials = computed(() => user.value?.initials ?? '??')
const name     = computed(() => user.value?.name ?? 'Signed out')
const role     = computed(() => user.value?.role ?? '')
const workspaceSlug = computed(() => company.value?.slug ?? '')
const workspaceName = computed(() => company.value?.name ?? '')

async function doSignOut() {
  open.value = false
  await signOut()
  router.push({ name: 'login' })
}

function openChangePin() {
  open.value = false
  pinDialogOpen.value = true
}

async function copySlug() {
  if (!workspaceSlug.value) return
  try {
    await navigator.clipboard.writeText(workspaceSlug.value)
    copied.value = true
    setTimeout(() => { copied.value = false }, 1500)
  } catch {
    // Clipboard API may be unavailable on insecure contexts — fallback no-op.
  }
}
</script>

<template>
  <div class="relative p-3 border-t border-cream-200">
    <button
      class="w-full flex items-center gap-3 px-2 py-2 rounded-md hover:bg-cream-100"
      @click="open = !open"
    >
      <div class="w-8 h-8 rounded-full bg-gradient-to-br from-brand-500 to-accent-500 flex items-center justify-center text-white text-sm font-medium">
        {{ initials }}
      </div>
      <div class="flex-1 min-w-0 text-left">
        <div class="text-sm font-medium text-ink-900 truncate">{{ name }}</div>
        <div class="text-xs text-ink-500 truncate">{{ role }}</div>
      </div>
      <Settings class="w-4 h-4 text-ink-500/60" />
    </button>

    <div
      v-if="open"
      class="absolute bottom-full left-3 right-3 mb-2 bg-white border border-cream-200 rounded-md shadow-lg z-10 overflow-hidden"
    >
      <div v-if="workspaceSlug" class="px-3 py-2.5 bg-cream-50 border-b border-cream-200">
        <div class="text-[10px] uppercase tracking-wider text-ink-500/70 font-medium mb-0.5">Your workspace</div>
        <div class="text-sm font-medium text-ink-900 truncate">{{ workspaceName }}</div>
        <button
          @click="copySlug"
          class="mt-1 flex items-center gap-1.5 text-xs font-mono text-brand-700 hover:text-brand-800 group"
          title="Click to copy your workspace URL for kiosk sign-in"
        >
          <span class="truncate">{{ workspaceSlug }}</span>
          <Check v-if="copied" class="w-3 h-3 text-emerald-600 flex-shrink-0" />
          <Copy v-else class="w-3 h-3 opacity-60 group-hover:opacity-100 flex-shrink-0" />
        </button>
        <p class="mt-1 text-[10px] leading-tight text-ink-500/70">Use this for kiosk PIN sign-in</p>
      </div>
      <div class="py-1">
        <button
          @click="openChangePin"
          class="w-full px-3 py-2 text-left text-sm text-ink-700 hover:bg-cream-100 flex items-center gap-2"
        >
          <KeyRound class="w-4 h-4" /> Change PIN
        </button>
        <button
          @click="doSignOut"
          class="w-full px-3 py-2 text-left text-sm text-ink-700 hover:bg-cream-100 flex items-center gap-2"
        >
          <LogOut class="w-4 h-4" /> Sign out
        </button>
      </div>
    </div>

    <ChangePinDialog
      :open="pinDialogOpen"
      @update:open="(v) => pinDialogOpen = v"
    />
  </div>
</template>

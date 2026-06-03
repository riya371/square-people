<script setup>
import { computed, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useRoute, useRouter } from 'vue-router'
import { Search, Bell, Plus, Menu, Copy, Check } from '@lucide/vue'
import { useTopbarSearch } from '@/composables/useTopbarSearch.js'
import { useAuthStore } from '@/stores/auth'

const route = useRoute()
const router = useRouter()
const title = computed(() => route.meta?.title ?? '')
const { query } = useTopbarSearch()
const authStore = useAuthStore()
const { company } = storeToRefs(authStore)
const workspaceName = computed(() => company.value?.name ?? '')
const workspaceSlug = computed(() => company.value?.slug ?? '')

const mobileSearchOpen = ref(false)
const slugCopied = ref(false)

async function copySlug() {
  if (!workspaceSlug.value) return
  try {
    await navigator.clipboard.writeText(workspaceSlug.value)
    slugCopied.value = true
    setTimeout(() => { slugCopied.value = false }, 1500)
  } catch { /* ignore */ }
}

defineEmits(['toggle-sidebar'])

const ROUTE_TO_NEW = {
  employees: { label: 'New employee', to: { name: 'employees', query: { create: '1' } } },
  teams: { label: 'New team', to: { name: 'teams', query: { create: '1' } } },
  departments: { label: 'New department', to: { name: 'departments', query: { create: '1' } } },
  projects: { label: 'New project', to: { name: 'projects', query: { create: '1' } } },
  tasks: { label: 'New task', to: { name: 'tasks', query: { create: '1' } } },
  leaves: { label: 'Request leave', to: { name: 'leaves', query: { create: '1' } } },
}
const newAction = computed(() => ROUTE_TO_NEW[route.name] || null)
function goCreate() { if (newAction.value) router.push(newAction.value.to) }
</script>

<template>
  <header class="sticky top-0 z-20 bg-white border-b border-cream-200 px-4 sm:px-6 lg:px-8 py-4">
    <div class="flex items-center justify-between gap-3">
      <div class="flex items-center gap-3 min-w-0">
        <button
          class="p-2 -ml-2 rounded-md hover:bg-cream-100 lg:hidden"
          @click="$emit('toggle-sidebar')"
          aria-label="Open menu"
        >
          <Menu class="w-5 h-5" />
        </button>
        <slot name="title">
          <h1 class="text-lg sm:text-xl font-semibold truncate">{{ title }}</h1>
        </slot>
        <button
          v-if="workspaceName"
          @click="copySlug"
          :title="`Workspace URL: ${workspaceSlug} (click to copy)`"
          class="hidden sm:inline-flex text-xs px-2 py-0.5 rounded-full bg-brand-100 hover:bg-brand-200 text-brand-800 font-medium items-center gap-1.5 transition"
        >
          <span class="w-1.5 h-1.5 rounded-full bg-brand-500"></span>
          <span>{{ workspaceName }}</span>
          <span v-if="workspaceSlug" class="font-mono text-brand-700/70 hidden md:inline">· {{ workspaceSlug }}</span>
          <Check v-if="slugCopied" class="w-3 h-3 text-emerald-600" />
          <Copy v-else class="w-3 h-3 opacity-50 hover:opacity-100" />
        </button>
      </div>

      <div class="flex items-center gap-2 sm:gap-3">
        <div class="relative hidden md:block">
          <Search class="w-4 h-4 absolute left-3 top-2.5 text-ink-500/60 pointer-events-none" />
          <input
            v-model="query"
            class="pl-9 pr-3 py-2 w-48 lg:w-64 rounded-md border border-cream-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            placeholder="Search…"
          />
        </div>
        <button
          class="p-2 rounded-md hover:bg-cream-100 md:hidden"
          @click="mobileSearchOpen = !mobileSearchOpen"
          aria-label="Toggle search"
        >
          <Search class="w-4 h-4" />
        </button>
        <button class="p-2 rounded-md hover:bg-cream-100" aria-label="Notifications">
          <Bell class="w-4 h-4" />
        </button>
        <slot name="cta">
          <button
            v-if="newAction"
            @click="goCreate"
            class="px-3 py-2 rounded-md bg-brand-500 text-white text-sm font-semibold hover:bg-brand-600 flex items-center gap-1.5"
          >
            <Plus class="w-4 h-4" />
            <span class="hidden sm:inline">{{ newAction.label }}</span>
          </button>
        </slot>
      </div>
    </div>

    <!-- Mobile collapsing search row -->
    <div v-if="mobileSearchOpen" class="md:hidden mt-3">
      <div class="relative">
        <Search class="w-4 h-4 absolute left-3 top-2.5 text-ink-500/60 pointer-events-none" />
        <input
          v-model="query"
          class="w-full pl-9 pr-3 py-2 rounded-md border border-cream-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          placeholder="Search…"
          autofocus
        />
      </div>
    </div>
  </header>
</template>

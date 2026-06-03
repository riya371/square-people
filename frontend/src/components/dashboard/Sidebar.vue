<script setup>
import { computed } from 'vue'
import { Cookie } from '@lucide/vue'
import { NAV_SECTIONS } from './nav.js'
import SidebarNavItem from './SidebarNavItem.vue'
import SidebarSectionLabel from './SidebarSectionLabel.vue'
import UserMenu from './UserMenu.vue'
import { useAuthStore } from '@/stores/auth'

defineProps({ open: { type: Boolean, default: false } })
const emit = defineEmits(['navigate'])

const auth = useAuthStore()
// Hide nav items above the current role; drop sections left empty.
const sections = computed(() =>
  NAV_SECTIONS
    .map((s) => ({ ...s, items: s.items.filter((i) => !i.min || auth.atLeast(i.min)) }))
    .filter((s) => s.items.length),
)
</script>

<template>
  <aside
    :class="[
      'w-64 bg-white border-r border-cream-200 flex flex-col flex-shrink-0',
      'fixed inset-y-0 left-0 z-40 transition-transform lg:static lg:translate-x-0',
      open ? 'translate-x-0' : '-translate-x-full',
    ]"
  >
    <div class="px-6 py-5 border-b border-cream-200 flex items-center gap-3">
      <div class="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-500 to-accent-500 flex items-center justify-center shadow-sm">
        <Cookie class="w-5 h-5 text-white" />
      </div>
      <div class="leading-tight">
        <div class="font-bold text-ink-900 text-[15px]">SquarePeople</div>
        <div class="text-[10px] uppercase tracking-wider text-ink-500/70 font-medium">by Square Feet</div>
      </div>
    </div>

    <nav class="flex-1 p-3 overflow-y-auto space-y-1">
      <template v-for="(section, idx) in sections" :key="idx">
        <SidebarSectionLabel v-if="section.label">{{ section.label }}</SidebarSectionLabel>
        <SidebarNavItem
          v-for="item in section.items"
          :key="item.label"
          :to="item.to"
          :icon="item.icon"
          :label="item.label"
          @navigate="emit('navigate')"
        />
      </template>
    </nav>

    <UserMenu />
  </aside>
</template>

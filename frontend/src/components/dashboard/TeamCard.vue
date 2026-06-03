<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { MoreHorizontal, Pencil, Users, Trash2 } from '@lucide/vue'
import AvatarStack from './AvatarStack.vue'
import { useAuthStore } from '@/stores/auth'

defineProps({
  team: { type: Object, required: true },
})
const emit = defineEmits(['edit', 'members', 'delete'])

const auth = useAuthStore()

const menuOpen = ref(false)
const root = ref(null)

function toggle() { menuOpen.value = !menuOpen.value }
function close() { menuOpen.value = false }
function choose(action, team) {
  close()
  emit(action, team)
}

function onDocClick(e) {
  if (root.value && !root.value.contains(e.target)) close()
}
onMounted(() => document.addEventListener('click', onDocClick))
onUnmounted(() => document.removeEventListener('click', onDocClick))
</script>

<template>
  <div class="bg-white p-5 rounded-lg border border-cream-200 hover:shadow-md transition">
    <div class="flex items-center justify-between mb-3">
      <h3 class="font-semibold">{{ team.name }}</h3>
      <div v-if="auth.can('teams.manage')" class="relative" ref="root">
        <button
          type="button"
          @click.stop="toggle"
          class="p-1 rounded hover:bg-cream-100"
          aria-label="Team actions"
        >
          <MoreHorizontal class="w-4 h-4 text-ink-500" />
        </button>
        <div
          v-if="menuOpen"
          class="absolute right-0 top-8 z-20 w-44 bg-white rounded-md border border-cream-200 shadow-lg py-1"
        >
          <button type="button" @click="choose('edit', team)" class="w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-cream-50">
            <Pencil class="w-4 h-4 text-ink-500" /> Edit
          </button>
          <button type="button" @click="choose('members', team)" class="w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-cream-50">
            <Users class="w-4 h-4 text-ink-500" /> Manage members
          </button>
          <button type="button" @click="choose('delete', team)" class="w-full flex items-center gap-2 px-3 py-2 text-sm text-left text-rose-600 hover:bg-rose-50">
            <Trash2 class="w-4 h-4" /> Delete
          </button>
        </div>
      </div>
    </div>
    <p class="text-sm text-ink-500 mb-4">{{ team.description }}</p>
    <AvatarStack :avatars="team.avatars" :max="3" size="sm" />
    <div class="flex items-center justify-between text-xs text-ink-500 mt-3">
      <span>Lead: {{ team.lead }}</span>
      <span>{{ team.activeProjects }} active projects</span>
    </div>
  </div>
</template>

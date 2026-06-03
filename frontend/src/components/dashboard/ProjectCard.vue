<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { CheckSquare, Calendar, MoreHorizontal, Pencil, Activity, Link2, Trash2 } from '@lucide/vue'
import StatusPill from './StatusPill.vue'
import { useAuthStore } from '@/stores/auth'

const props = defineProps({
  project: { type: Object, required: true },
})
const emit = defineEmits(['edit', 'status', 'teams', 'delete'])

const auth = useAuthStore()

const STATUS_OPTIONS = [
  { value: 'on-track', label: 'On track' },
  { value: 'at-risk', label: 'At risk' },
  { value: 'in-progress', label: 'In progress' },
  { value: 'completed', label: 'Completed' },
]

const progressBarColor = computed(() => ({
  'on-track': 'bg-emerald-500',
  'in-progress': 'bg-amber-500',
  'at-risk': 'bg-rose-500',
  'completed': 'bg-brand-500',
})[props.project.status] ?? 'bg-brand-500')

const statusLabel = computed(() =>
  (STATUS_OPTIONS.find((o) => o.value === props.project.status)?.label) ?? props.project.status
)

const menuOpen = ref(false)
const statusOpen = ref(false)
const root = ref(null)

function toggle() { menuOpen.value = !menuOpen.value; statusOpen.value = false }
function close() { menuOpen.value = false; statusOpen.value = false }
function choose(action) { close(); emit(action, props.project) }
function chooseStatus(value) {
  close()
  if (value !== props.project.status) emit('status', { project: props.project, status: value })
}

function onDocClick(e) {
  if (root.value && !root.value.contains(e.target)) close()
}
onMounted(() => document.addEventListener('click', onDocClick))
onUnmounted(() => document.removeEventListener('click', onDocClick))
</script>

<template>
  <div class="bg-white p-5 rounded-lg border border-cream-200">
    <div class="flex items-start justify-between mb-3 gap-3">
      <div>
        <h3 class="font-semibold">{{ project.name }}</h3>
        <p class="text-sm text-ink-500 mt-1">{{ project.scope }}</p>
      </div>
      <div class="flex items-center gap-2">
        <StatusPill :tone="project.status">{{ statusLabel }}</StatusPill>
        <div v-if="auth.can('projects.manage')" class="relative" ref="root">
          <button
            type="button"
            @click.stop="toggle"
            class="p-1 rounded hover:bg-cream-100"
            aria-label="Project actions"
          >
            <MoreHorizontal class="w-4 h-4 text-ink-500" />
          </button>
          <div
            v-if="menuOpen"
            class="absolute right-0 top-8 z-20 w-44 bg-white rounded-md border border-cream-200 shadow-lg py-1"
          >
            <button type="button" @click="choose('edit')" class="w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-cream-50">
              <Pencil class="w-4 h-4 text-ink-500" /> Edit
            </button>
            <div class="relative">
              <button type="button" @click.stop="statusOpen = !statusOpen" class="w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-cream-50">
                <Activity class="w-4 h-4 text-ink-500" /> Change status
              </button>
              <div v-if="statusOpen" class="mt-0.5 border-t border-cream-100 bg-cream-50/60">
                <button
                  v-for="o in STATUS_OPTIONS"
                  :key="o.value"
                  type="button"
                  @click="chooseStatus(o.value)"
                  class="w-full flex items-center justify-between px-3 py-1.5 pl-9 text-sm text-left hover:bg-cream-100"
                >
                  <span>{{ o.label }}</span>
                  <span v-if="o.value === project.status" class="text-xs text-brand-600">Current</span>
                </button>
              </div>
            </div>
            <button v-if="auth.can('projects.delete')" type="button" @click="choose('teams')" class="w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-cream-50">
              <Link2 class="w-4 h-4 text-ink-500" /> Link teams
            </button>
            <button v-if="auth.can('projects.delete')" type="button" @click="choose('delete')" class="w-full flex items-center gap-2 px-3 py-2 text-sm text-left text-rose-600 hover:bg-rose-50">
              <Trash2 class="w-4 h-4" /> Delete
            </button>
          </div>
        </div>
      </div>
    </div>
    <div class="space-y-2 mb-3">
      <div class="flex items-center justify-between text-xs text-ink-500">
        <span>Progress</span><span>{{ Math.round(project.progress * 100) }}%</span>
      </div>
      <div class="h-2 bg-cream-200 rounded-full overflow-hidden">
        <div :class="['h-full rounded-full', progressBarColor]" :style="{ width: (project.progress * 100) + '%' }"></div>
      </div>
    </div>
    <div class="flex items-center justify-between text-xs text-ink-500 pt-3 border-t border-cream-200">
      <span class="flex items-center gap-1.5"><CheckSquare class="w-3 h-3" />{{ project.tasksDone }}/{{ project.tasksTotal }} tasks</span>
      <span class="flex items-center gap-1.5"><Calendar class="w-3 h-3" />Due {{ project.dueDate }}</span>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { GitBranch } from '@lucide/vue'
import { PRIORITY_TONES } from '@/lib/tones.js'
import Avatar from './Avatar.vue'

const props = defineProps({
  task: { type: Object, required: true },
})

const tone = computed(() => PRIORITY_TONES[props.task.priority] ?? PRIORITY_TONES.medium)
const priorityLabel = computed(() => ({ high: 'High', medium: 'Medium', low: 'Low' })[props.task.priority])
</script>

<template>
  <div :class="['bg-white p-3 rounded-md shadow-sm border border-cream-200 cursor-grab', task.completed ? 'opacity-75' : '']">
    <div class="flex items-center gap-2 mb-2">
      <span :class="['text-xs px-1.5 py-0.5 rounded font-medium', tone.bg, tone.text]">{{ priorityLabel }}</span>
      <span class="text-xs text-ink-500/60">{{ task.code }}</span>
    </div>
    <div :class="['text-sm font-medium mb-2', task.completed ? 'line-through text-ink-500' : '']">{{ task.title }}</div>
    <div v-if="task.subtasks" class="flex items-center gap-1 mb-2 text-xs text-ink-500">
      <GitBranch class="w-3 h-3" /> {{ task.subtasks }} subtasks
    </div>
    <div class="flex items-center justify-between">
      <span class="text-xs text-ink-500">{{ task.project }}</span>
      <Avatar v-if="task.assignee" :initials="task.assignee.initials" :gradient="task.assignee.gradient" size="xs" />
      <span v-else class="w-6 h-6 rounded-full bg-cream-200 text-ink-500/60 text-[10px] flex items-center justify-center">—</span>
    </div>
  </div>
</template>

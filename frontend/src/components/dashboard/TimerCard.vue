<script setup>
import { computed } from 'vue'
import { Pause, Play, Square } from '@lucide/vue'
import { fmtTimer } from '@/lib/dates'

const props = defineProps({
  current: { type: Object, default: null },
  elapsed: { type: [Number, String], required: true },
  isRunning: { type: Boolean, required: true },
})
const emit = defineEmits(['pause', 'resume', 'stop', 'start'])

const elapsedFmt = computed(() =>
  typeof props.elapsed === 'number' ? fmtTimer(props.elapsed) : props.elapsed,
)
</script>

<template>
  <div class="bg-gradient-to-br from-brand-600 via-brand-500 to-accent-500 text-white p-6 rounded-lg mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
    <template v-if="!current">
      <div>
        <div class="text-xs uppercase tracking-wider opacity-80 mb-1">Currently tracking</div>
        <div class="text-lg font-medium">No active task</div>
        <div class="text-sm opacity-80">Start tracking time against a task.</div>
      </div>
      <div class="sm:text-right">
        <button
          class="px-4 py-2 rounded-md bg-white text-brand-700 text-sm font-semibold flex items-center gap-1.5"
          @click="emit('start')"
        >
          <Play class="w-3.5 h-3.5" />Start tracking
        </button>
      </div>
    </template>
    <template v-else>
      <div>
        <div class="text-xs uppercase tracking-wider opacity-80 mb-1">Currently tracking</div>
        <div class="text-lg font-medium">{{ current?.task?.title ?? 'No active task' }}</div>
        <div class="text-sm opacity-80">{{ current?.task?.project?.name }} <span v-if="current?.task?.code">· {{ current.task.code }}</span></div>
      </div>
      <div class="sm:text-right">
        <div class="font-mono text-3xl sm:text-4xl font-semibold tabular-nums">{{ elapsedFmt }}</div>
        <div class="flex gap-2 mt-3 sm:justify-end">
          <button
            v-if="isRunning"
            class="px-3 py-1.5 rounded-md bg-white/20 hover:bg-white/30 text-sm flex items-center gap-1.5"
            @click="emit('pause')"
          >
            <Pause class="w-3.5 h-3.5" />Pause
          </button>
          <button
            v-else
            class="px-3 py-1.5 rounded-md bg-white/20 hover:bg-white/30 text-sm flex items-center gap-1.5"
            @click="emit('resume')"
          >
            <Play class="w-3.5 h-3.5" />Resume
          </button>
          <button
            class="px-3 py-1.5 rounded-md bg-white text-brand-700 text-sm font-semibold flex items-center gap-1.5"
            @click="emit('stop')"
          >
            <Square class="w-3.5 h-3.5" />Stop
          </button>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { storeToRefs } from 'pinia'
import TimerCard from '@/components/dashboard/TimerCard.vue'
import DataTable from '@/components/dashboard/DataTable.vue'
import StartTimerDialog from '@/components/forms/StartTimerDialog.vue'
import { useTimeStore } from '@/stores/time'
import { fmtTimer, clockTime } from '@/lib/dates'

const store = useTimeStore()
const { entries, current, elapsed, isRunning, todayTotalFmt } = storeToRefs(store)
onMounted(() => store.refresh())

const pickerOpen = ref(false)

function openPicker() { pickerOpen.value = true }
async function handlePick(taskId) {
  try {
    await store.start({ taskId })
  } catch (err) {
    console.error('Failed to start timer', err)
  }
}

function fmt(sec) { return fmtTimer(sec) }
</script>

<template>
  <section class="p-4 sm:p-6 lg:p-8">
    <TimerCard
      :current="current"
      :elapsed="elapsed"
      :is-running="isRunning"
      @pause="store.pause"
      @resume="store.resume"
      @stop="store.stop"
      @start="openPicker"
    />

    <h3 class="font-semibold mb-3">Today's logs</h3>
    <DataTable :rows="entries">
      <template #head>
        <th class="px-4 py-3 font-medium">Task</th>
        <th class="px-4 py-3 font-medium">Project</th>
        <th class="px-4 py-3 font-medium">Start</th>
        <th class="px-4 py-3 font-medium">End</th>
        <th class="px-4 py-3 font-medium text-right">Duration</th>
      </template>
      <template #default>
        <tr v-for="e in entries" :key="e.id">
          <td class="px-4 py-3 font-medium">{{ e.task?.title }}</td>
          <td class="px-4 py-3 text-ink-600">{{ e.task?.project?.name }}</td>
          <td class="px-4 py-3 text-ink-500">{{ clockTime(e.startedAt) }}</td>
          <td class="px-4 py-3 text-ink-500" :class="{ 'text-ink-500/60': !e.endedAt }">
            {{ e.endedAt ? clockTime(e.endedAt) : '— in progress' }}
          </td>
          <td class="px-4 py-3 text-right font-mono">{{ fmt(e.durationSec) }}</td>
        </tr>
      </template>
      <template #foot>
        <tr>
          <td colspan="4" class="px-4 py-3 text-xs font-medium text-ink-600 uppercase tracking-wider">Total today</td>
          <td class="px-4 py-3 text-right font-mono font-semibold">{{ todayTotalFmt }}</td>
        </tr>
      </template>
      <template #mobileRow="{ row: e }">
        <div class="p-4">
          <div class="flex justify-between gap-2">
            <div class="font-medium">{{ e.task?.title }}</div>
            <div class="font-mono text-sm">{{ fmt(e.durationSec) }}</div>
          </div>
          <div class="text-xs text-ink-500">{{ e.task?.project?.name }} · {{ clockTime(e.startedAt) }} – {{ e.endedAt ? clockTime(e.endedAt) : 'in progress' }}</div>
        </div>
      </template>
    </DataTable>

    <StartTimerDialog
      :open="pickerOpen"
      @update:open="(v) => pickerOpen = v"
      @pick="handlePick"
    />
  </section>
</template>

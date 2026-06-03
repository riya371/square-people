<script setup>
import { computed } from 'vue'
import { ChevronLeft, ChevronRight } from '@lucide/vue'
import AttendanceLegend from './AttendanceLegend.vue'

const props = defineProps({
  month: { type: Date, required: true },
  days: { type: Array, required: true },
})
defineEmits(['prev', 'next'])

const monthLabel = computed(() =>
  props.month.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
)

const STATUS_CLASS = {
  present: 'bg-emerald-100 text-emerald-700',
  late:    'bg-amber-100 text-amber-700',
  leave:   'bg-rose-100 text-rose-700',
}

function cellClass(day) {
  if (!day.inMonth) return ''
  if (day.status && STATUS_CLASS[day.status]) return `${STATUS_CLASS[day.status]} font-medium`
  return 'bg-cream-100 text-ink-500/60'
}
</script>

<template>
  <div class="bg-white p-6 rounded-lg border border-cream-200">
    <div class="flex items-center justify-between mb-4">
      <h3 class="font-semibold">{{ monthLabel }}</h3>
      <div class="flex gap-1">
        <button class="p-1 rounded hover:bg-cream-100" @click="$emit('prev')" aria-label="Previous month"><ChevronLeft class="w-4 h-4" /></button>
        <button class="p-1 rounded hover:bg-cream-100" @click="$emit('next')" aria-label="Next month"><ChevronRight class="w-4 h-4" /></button>
      </div>
    </div>
    <div class="grid grid-cols-7 gap-1 text-center">
      <div v-for="(d, i) in ['M','T','W','T','F','S','S']" :key="i" class="text-xs text-ink-500/60 font-medium pb-2">{{ d }}</div>
      <div
        v-for="day in days"
        :key="day.key"
        :class="['aspect-square rounded-md text-xs flex items-center justify-center', cellClass(day)]"
      >
        {{ day.date?.getDate() }}
      </div>
    </div>
    <div class="mt-4">
      <AttendanceLegend />
    </div>
  </div>
</template>

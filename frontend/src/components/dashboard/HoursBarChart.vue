<script setup>
const props = defineProps({
  // [{ day: 'Mon', percent: 60, tone: 'brand-500' | 'brand-300' | 'cream-200' }]
  data: { type: Array, required: true },
})

const toneClass = (t) => ({
  'brand-500': 'bg-brand-500',
  'brand-300': 'bg-brand-300',
  'cream-200': 'bg-cream-200',
})[t] ?? 'bg-brand-500'
</script>

<template>
  <div class="flex items-end gap-3 h-48">
    <div v-for="d in data" :key="d.day" class="flex-1 flex flex-col items-center gap-2">
      <div :class="['w-full rounded-t', toneClass(d.tone)]" :style="{ height: d.percent + '%' }"></div>
      <span :class="['text-xs', d.tone === 'cream-200' ? 'text-ink-500/60' : 'text-ink-500']">{{ d.day }}</span>
    </div>
  </div>
</template>

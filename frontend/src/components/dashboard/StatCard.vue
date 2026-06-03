<script setup>
import { computed } from 'vue'
import { TrendingUp } from '@lucide/vue'

const props = defineProps({
  label: { type: String, required: true },
  value: { type: [String, Number], required: true },
  sub: { type: String, default: '' },
  delta: { type: String, default: '' },
  icon: { type: [Object, Function], required: true },
  iconClass: { type: String, default: 'text-brand-600' },
})

const subTone = computed(() => {
  if (props.delta) return 'text-emerald-600'
  if (props.sub?.toLowerCase().includes('awaiting')) return 'text-rose-600'
  return 'text-ink-500'
})
</script>

<template>
  <div class="bg-white p-5 rounded-lg border border-cream-200">
    <div class="flex items-center justify-between mb-2">
      <span class="text-xs text-ink-500 font-medium uppercase tracking-wide">{{ label }}</span>
      <component :is="icon" :class="['w-4 h-4', iconClass]" />
    </div>
    <div class="text-3xl font-semibold">{{ value }}</div>
    <div :class="['text-xs mt-1 flex items-center gap-1', subTone]">
      <TrendingUp v-if="delta" class="w-3 h-3" />
      {{ delta || sub }}
    </div>
  </div>
</template>

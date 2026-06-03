<script setup>
import { computed } from 'vue'
import { Check } from '@lucide/vue'

const props = defineProps({
  // 1-based index of the current step
  current: { type: Number, required: true },
  steps: {
    type: Array,
    default: () => ['Account', 'Company', 'Invite'],
  },
})

function status(i) {
  // i is 1-based
  if (i < props.current) return 'done'
  if (i === props.current) return 'active'
  return 'pending'
}

const items = computed(() =>
  props.steps.map((label, idx) => ({
    label,
    number: idx + 1,
    state: status(idx + 1),
  })),
)
</script>

<template>
  <div class="flex items-center gap-2 mb-8">
    <template v-for="(item, idx) in items" :key="item.label">
      <div class="flex items-center gap-2">
        <div
          class="w-7 h-7 rounded-full text-xs font-bold flex items-center justify-center"
          :class="{
            'bg-emerald-500 text-white': item.state === 'done',
            'bg-brand-500 text-white': item.state === 'active',
            'bg-cream-200 text-ink-500': item.state === 'pending',
          }"
        >
          <Check v-if="item.state === 'done'" class="w-3.5 h-3.5" />
          <span v-else>{{ item.number }}</span>
        </div>
        <span
          class="text-xs font-semibold"
          :class="{
            'text-emerald-700': item.state === 'done',
            'text-brand-700': item.state === 'active',
            'text-ink-500': item.state === 'pending',
          }"
        >{{ item.label }}</span>
      </div>
      <div
        v-if="idx < items.length - 1"
        class="flex-1 h-px"
        :class="items[idx].state === 'done' ? 'bg-emerald-500' : 'bg-cream-200'"
      ></div>
    </template>
  </div>
</template>

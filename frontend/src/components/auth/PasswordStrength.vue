<script setup>
import { computed } from 'vue'

const props = defineProps({
  password: { type: String, default: '' },
})

const score = computed(() => {
  const p = props.password
  if (!p) return 0
  let s = 1
  if (p.length >= 6) s = 2
  if (p.length >= 10) s = 3
  if (p.length >= 10 && /[^a-zA-Z0-9]/.test(p)) s = 4
  return s
})

const label = computed(() => {
  switch (score.value) {
    case 0: return 'Use at least 10 characters'
    case 1: return 'Too short — keep going'
    case 2: return 'Weak — try a longer password'
    case 3: return 'Strong — add a special character to make it stronger'
    case 4: return 'Very strong — looks great'
    default: return ''
  }
})
</script>

<template>
  <div>
    <div class="flex gap-1 mt-2">
      <div
        v-for="i in 4"
        :key="i"
        class="flex-1 h-1 rounded-full transition-colors"
        :class="i <= score ? 'bg-brand-500' : 'bg-cream-200'"
      ></div>
    </div>
    <p class="text-xs text-ink-500 mt-1.5">{{ label }}</p>
  </div>
</template>

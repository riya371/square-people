<script setup>
import { computed } from 'vue'
import { STATUS_TONES } from '@/lib/tones.js'

const props = defineProps({
  tone: { type: String, required: true }, // key of STATUS_TONES
  dot: { type: Boolean, default: false },
})

const t = computed(() => STATUS_TONES[props.tone] ?? STATUS_TONES.inactive)
</script>

<template>
  <span
    :class="['text-xs px-2 py-0.5 rounded-full inline-flex items-center gap-1', t.bg, t.text]"
  >
    <span v-if="dot" :class="['w-1.5 h-1.5 rounded-full', t.dot]"></span>
    <slot />
  </span>
</template>

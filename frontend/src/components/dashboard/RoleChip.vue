<script setup>
import { computed } from 'vue'
import { X } from '@lucide/vue'
import { ROLE_TONES } from '@/lib/tones.js'

const props = defineProps({
  tone: { type: String, default: 'brand' },
  removable: { type: Boolean, default: false },
})
defineEmits(['remove'])

const t = computed(() => ROLE_TONES[props.tone] ?? ROLE_TONES.brand)
</script>

<template>
  <span :class="['text-xs px-2 py-0.5 rounded-full inline-flex items-center gap-1', t.bg, t.text]">
    <slot />
    <button
      v-if="removable"
      type="button"
      @click.stop="$emit('remove')"
      class="-mr-0.5 ml-0.5 rounded-full p-0.5 hover:bg-ink-900/10 transition"
      aria-label="Remove role"
    >
      <X class="w-3 h-3" />
    </button>
  </span>
</template>

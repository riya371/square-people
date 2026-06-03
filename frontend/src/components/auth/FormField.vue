<script setup>
import { useSlots } from 'vue'

defineProps({
  label: { type: String, required: true },
  for: { type: String, default: null },
  helper: { type: String, default: null },
})

const slots = useSlots()
</script>

<template>
  <div>
    <div :class="slots.action ? 'flex items-center justify-between mb-1.5' : 'mb-1.5'">
      <label
        :for="$props.for"
        class="block text-xs font-semibold text-ink-600 uppercase tracking-wide"
      >{{ label }}</label>
      <slot name="action" />
    </div>
    <slot />
    <p v-if="helper" class="text-xs text-ink-500 mt-1.5">{{ helper }}</p>
  </div>
</template>

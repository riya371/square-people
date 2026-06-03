<script setup>
const props = defineProps({
  modelValue: { type: Array, default: () => [] },
})

const emit = defineEmits(['update:modelValue'])

const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function toggle(day) {
  const set = new Set(props.modelValue)
  if (set.has(day)) set.delete(day)
  else set.add(day)
  emit('update:modelValue', days.filter(d => set.has(d)))
}

function isOn(day) {
  return props.modelValue.includes(day)
}
</script>

<template>
  <div class="flex gap-1.5">
    <button
      v-for="day in days"
      :key="day"
      type="button"
      @click="toggle(day)"
      :aria-pressed="isOn(day)"
      class="flex-1 px-2 py-2 rounded-md text-xs transition-colors"
      :class="isOn(day)
        ? 'border border-brand-500 bg-brand-100 text-brand-800 font-semibold'
        : 'border border-cream-300 bg-white text-ink-500 font-medium hover:bg-cream-100'"
    >{{ day }}</button>
  </div>
</template>

<script setup>
defineProps({
  modelValue: { type: String, default: '' },
  prefix: { type: String, default: 'app.squarepeople.io/' },
  placeholder: { type: String, default: 'squarefeet' },
  id: { type: String, default: 'workspace-url' },
})

defineEmits(['update:modelValue'])
</script>

<template>
  <div class="flex items-stretch rounded-md border border-cream-300 overflow-hidden bg-white focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-500/20">
    <span class="px-3 py-2.5 bg-cream-100 border-r border-cream-300 text-sm text-ink-500 whitespace-nowrap">{{ prefix }}</span>
    <input
      :id="id"
      :value="modelValue"
      @input="$emit('update:modelValue', $event.target.value)"
      type="text"
      :placeholder="placeholder"
      class="flex-1 min-w-0 px-3 py-2.5 text-sm focus:outline-none"
    />
  </div>
</template>

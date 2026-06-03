<script setup>
const props = defineProps({
  tabs: { type: Array, required: true },   // [{ key, label, count? }]
  modelValue: { type: String, required: true },
})
const emit = defineEmits(['update:modelValue'])
</script>

<template>
  <div class="border-b border-cream-200 mb-5 overflow-x-auto">
    <nav class="flex gap-6 text-sm min-w-max">
      <button
        v-for="t in tabs"
        :key="t.key"
        @click="emit('update:modelValue', t.key)"
        :class="['pb-3 whitespace-nowrap', modelValue === t.key ? 'border-b-2 border-brand-500 text-brand-700 font-semibold' : 'text-ink-500']"
      >
        {{ t.label }}
        <span v-if="t.count != null" class="ml-1 text-xs px-1.5 py-0.5 rounded-full bg-cream-200">{{ t.count }}</span>
      </button>
    </nav>
  </div>
</template>

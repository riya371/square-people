<script setup>
import { PlusCircle } from '@lucide/vue'

defineProps({
  label: { type: String, required: true },
})
</script>

<template>
  <button class="bg-white rounded-lg border border-dashed border-cream-300 flex items-center justify-center min-h-[180px] hover:bg-cream-100 w-full">
    <div class="text-center text-ink-500/60">
      <PlusCircle class="w-8 h-8 mx-auto mb-2" />
      <div class="text-sm">{{ label }}</div>
    </div>
  </button>
</template>

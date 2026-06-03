<script setup>
defineProps({
  to: { type: Object, required: true },
  icon: { type: [Object, Function], required: true },
  label: { type: String, required: true },
})
defineEmits(['navigate'])
</script>

<template>
  <router-link
    :to="to"
    @click="$emit('navigate')"
    custom
    v-slot="{ navigate, isActive }"
  >
    <button
      @click="navigate"
      :class="[
        'w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors',
        isActive
          ? 'bg-brand-100 text-brand-800 font-semibold'
          : 'text-ink-600 hover:bg-cream-100',
      ]"
    >
      <component :is="icon" :class="['w-4 h-4', isActive ? 'text-brand-700' : '']" />
      {{ label }}
    </button>
  </router-link>
</template>

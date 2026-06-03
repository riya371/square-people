<script setup>
import { computed } from 'vue'
import { AVATAR_GRADIENTS } from '@/lib/tones.js'

const props = defineProps({
  initials: { type: String, required: true },
  gradient: { type: String, default: 'brand-accent' },
  size: { type: String, default: 'md' }, // 'xs'|'sm'|'md'|'lg'|'xl'
})

const sizeClasses = {
  xs: 'w-5 h-5 text-[10px]',
  sm: 'w-6 h-6 text-xs',
  md: 'w-8 h-8 text-xs',
  lg: 'w-10 h-10 text-sm',
  xl: 'w-20 h-20 text-2xl',
}

const cls = computed(() => sizeClasses[props.size] ?? sizeClasses.md)
const grad = computed(() => AVATAR_GRADIENTS[props.gradient] ?? AVATAR_GRADIENTS['brand-accent'])
</script>

<template>
  <div
    :class="['rounded-full bg-gradient-to-br flex items-center justify-center text-white font-medium flex-shrink-0', cls, grad]"
  >
    {{ initials }}
  </div>
</template>

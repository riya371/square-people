<script setup>
import { computed } from 'vue'
import Avatar from './Avatar.vue'

const props = defineProps({
  avatars: { type: Array, required: true }, // [{ initials, gradient }]
  max: { type: Number, default: 3 },
  size: { type: String, default: 'sm' },
})

const shown = computed(() => props.avatars.slice(0, props.max))
const overflow = computed(() => Math.max(0, props.avatars.length - props.max))
</script>

<template>
  <div class="flex items-center">
    <template v-for="(a, i) in shown" :key="i">
      <div :class="['ring-2 ring-white rounded-full', i > 0 ? '-ml-3' : '']">
        <Avatar :initials="a.initials" :gradient="a.gradient" :size="size" />
      </div>
    </template>
    <div
      v-if="overflow > 0"
      class="-ml-3 ring-2 ring-white w-6 h-6 rounded-full bg-cream-200 text-ink-600 text-xs flex items-center justify-center"
    >
      +{{ overflow }}
    </div>
  </div>
</template>

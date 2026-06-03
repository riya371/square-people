<script setup>
import { computed } from 'vue'
import { ChevronLeft, ChevronRight } from '@lucide/vue'

const props = defineProps({
  page: { type: Number, required: true },
  pageCount: { type: Number, required: true },
  total: { type: Number, required: true },
  pageSize: { type: Number, required: true },
})
const emit = defineEmits(['update:page'])

const start = computed(() => (props.page - 1) * props.pageSize + 1)
const end = computed(() => Math.min(props.page * props.pageSize, props.total))
const pages = computed(() => {
  const n = props.pageCount
  return Array.from({ length: n }, (_, i) => i + 1)
})

function go(p) {
  if (p < 1 || p > props.pageCount) return
  emit('update:page', p)
}
</script>

<template>
  <div class="flex items-center justify-between text-xs text-ink-500">
    <span>Showing {{ start }}–{{ end }} of {{ total }}</span>
    <div class="flex gap-1">
      <button class="px-2 py-1 rounded border border-cream-200 disabled:opacity-40"
              :disabled="page === 1" @click="go(page - 1)">
        <ChevronLeft class="w-3 h-3" />
      </button>
      <button
        v-for="p in pages"
        :key="p"
        :class="['px-2 py-1 rounded',
          p === page ? 'bg-brand-500 text-white' : 'border border-cream-200']"
        @click="go(p)"
      >{{ p }}</button>
      <button class="px-2 py-1 rounded border border-cream-200 disabled:opacity-40"
              :disabled="page === pageCount" @click="go(page + 1)">
        <ChevronRight class="w-3 h-3" />
      </button>
    </div>
  </div>
</template>

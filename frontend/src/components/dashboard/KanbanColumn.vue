<script setup>
import draggable from 'vuedraggable'
import { Plus } from '@lucide/vue'
import KanbanCard from './KanbanCard.vue'

const props = defineProps({
  modelValue: { type: Array, required: true },
  columnKey: { type: String, required: true },
  title: { type: String, required: true },
  bg: { type: String, required: true },     // tailwind class for column background
  dotClass: { type: String, required: true }, // tailwind class for the colored dot
})

const emit = defineEmits(['update:modelValue', 'change', 'add'])

function onChange(evt) {
  // vuedraggable emits { added, removed, moved } objects.
  emit('change', { columnKey: props.columnKey, evt })
}
</script>

<template>
  <div :class="['rounded-lg p-3', bg]">
    <div class="flex items-center justify-between mb-3 px-1">
      <div class="flex items-center gap-2">
        <span :class="['w-2 h-2 rounded-full', dotClass]"></span>
        <h3 class="font-semibold text-sm">{{ title }}</h3>
        <span class="text-xs text-ink-500">{{ modelValue.length }}</span>
      </div>
      <button @click="emit('add')" class="p-1 rounded hover:bg-cream-100" aria-label="Add task">
        <Plus class="w-4 h-4 text-ink-500" />
      </button>
    </div>
    <draggable
      :model-value="modelValue"
      @update:model-value="(v) => emit('update:modelValue', v)"
      group="kanban"
      item-key="id"
      class="space-y-2 min-h-[40px]"
      @change="onChange"
    >
      <template #item="{ element }">
        <KanbanCard :task="element" />
      </template>
    </draggable>
  </div>
</template>

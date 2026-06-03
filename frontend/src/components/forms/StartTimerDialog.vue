<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { storeToRefs } from 'pinia'
import Dialog from '@/components/ui/Dialog.vue'
import { useTasksStore } from '@/stores/tasks'

const props = defineProps({
  open: { type: Boolean, default: false },
})
const emit = defineEmits(['update:open', 'pick'])

const tasksStore = useTasksStore()
const { columns } = storeToRefs(tasksStore)

const selected = ref('')
const submitting = ref(false)

const tasks = computed(() => [
  ...(columns.value.pending || []),
  ...(columns.value.inProgress || []),
])

async function refresh() {
  await tasksStore.fetchKanban()
}

onMounted(() => refresh())

watch(() => props.open, (v) => {
  if (v) {
    selected.value = ''
    submitting.value = false
    refresh()
  }
})

function submit() {
  if (!selected.value || submitting.value) return
  submitting.value = true
  emit('pick', Number(selected.value))
  emit('update:open', false)
}
</script>

<template>
  <Dialog :open="open" title="Start tracking" @update:open="(v) => emit('update:open', v)">
    <div class="space-y-3">
      <p class="text-xs text-ink-500">Pick a task to start tracking time.</p>
      <div v-if="tasks.length === 0" class="p-4 rounded-md bg-cream-50 text-sm text-ink-500 text-center">
        No open tasks available.
      </div>
      <div v-else class="space-y-1.5 max-h-72 overflow-y-auto">
        <label
          v-for="t in tasks"
          :key="t.id"
          class="flex items-start gap-3 p-2.5 rounded-md border border-cream-200 hover:bg-cream-50 cursor-pointer"
          :class="{ 'border-brand-500 bg-brand-50/50': String(selected) === String(t.id) }"
        >
          <input type="radio" :value="t.id" v-model="selected" class="mt-1" />
          <div class="flex-1 min-w-0">
            <div class="text-sm font-medium text-ink-900 truncate">{{ t.title }}</div>
            <div class="text-xs text-ink-500 truncate">{{ t.project }} <span v-if="t.code">· {{ t.code }}</span></div>
          </div>
        </label>
      </div>
    </div>
    <template #footer>
      <button @click="emit('update:open', false)" type="button" class="px-3 py-1.5 rounded-md border border-cream-300 hover:bg-cream-50 text-sm">Cancel</button>
      <button @click="submit" :disabled="!selected || submitting" class="px-3 py-1.5 rounded-md bg-brand-500 hover:bg-brand-600 disabled:opacity-60 text-white text-sm font-semibold">Start</button>
    </template>
  </Dialog>
</template>

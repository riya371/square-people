<script setup>
import { ref, onMounted, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useRoute, useRouter } from 'vue-router'
import KanbanColumn from '@/components/dashboard/KanbanColumn.vue'
import CreateTaskDialog from '@/components/forms/CreateTaskDialog.vue'
import { useTasksStore } from '@/stores/tasks'

const route = useRoute()
const router = useRouter()
const store = useTasksStore()
const { columns } = storeToRefs(store)

const createOpen = ref(false)
const defaultStatus = ref('pending')

function openCreate(status) {
  defaultStatus.value = status || 'pending'
  createOpen.value = true
  router.replace({ query: { ...route.query, create: '1' } })
}
function closeCreate() {
  createOpen.value = false
  const { create, ...rest } = route.query
  router.replace({ query: rest })
}
function onDialogOpen(v) {
  if (v) createOpen.value = true
  else closeCreate()
}

onMounted(() => store.fetchKanban())

watch(() => route.query.create, (v) => {
  if (v === '1') createOpen.value = true
}, { immediate: true })

function onColumnChange({ columnKey, evt }) {
  if (evt?.added) store.move(evt.added.element.id, columnKey, evt.added.newIndex)
  else if (evt?.moved) store.move(evt.moved.element.id, columnKey, evt.moved.newIndex)
}
</script>

<template>
  <section class="p-4 sm:p-6 lg:p-8">
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-4 flex-nowrap lg:flex-wrap overflow-x-auto lg:overflow-visible snap-x snap-mandatory lg:snap-none">
      <KanbanColumn
        v-model="columns.pending"
        column-key="pending"
        title="Pending"
        bg="bg-cream-200"
        dot-class="bg-ink-500/40"
        class="min-w-[85vw] sm:min-w-0 snap-start"
        @change="onColumnChange"
        @add="openCreate('pending')"
      />
      <KanbanColumn
        v-model="columns.inProgress"
        column-key="inProgress"
        title="In progress"
        bg="bg-amber-50/50"
        dot-class="bg-amber-500"
        class="min-w-[85vw] sm:min-w-0 snap-start"
        @change="onColumnChange"
        @add="openCreate('inProgress')"
      />
      <KanbanColumn
        v-model="columns.completed"
        column-key="completed"
        title="Completed"
        bg="bg-emerald-50/50"
        dot-class="bg-emerald-500"
        class="min-w-[85vw] sm:min-w-0 snap-start"
        @change="onColumnChange"
        @add="openCreate('completed')"
      />
    </div>

    <CreateTaskDialog
      :open="createOpen"
      :default-status="defaultStatus"
      @update:open="onDialogOpen"
      @created="store.fetchKanban()"
    />
  </section>
</template>

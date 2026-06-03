<script setup>
import { ref, onMounted, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useRoute, useRouter } from 'vue-router'
import { Plus } from '@lucide/vue'
import ProjectCard from '@/components/dashboard/ProjectCard.vue'
import CreateProjectDialog from '@/components/forms/CreateProjectDialog.vue'
import EditProjectDialog from '@/components/forms/EditProjectDialog.vue'
import Dialog from '@/components/ui/Dialog.vue'
import { useProjectsStore } from '@/stores/projects'
import { useAuthStore } from '@/stores/auth'

const route = useRoute()
const router = useRouter()
const store = useProjectsStore()
const auth = useAuthStore()
const { list: projects, loading } = storeToRefs(store)
onMounted(() => store.fetchList())

const createOpen = ref(false)
function openCreate() {
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

watch(() => route.query.create, (v) => {
  if (v === '1') createOpen.value = true
}, { immediate: true })

// Edit / link teams
const editOpen = ref(false)
const selectedProject = ref(null)
function openEdit(project) {
  selectedProject.value = project
  editOpen.value = true
}
function openTeams(project) {
  // EditProjectDialog hosts team linking too
  selectedProject.value = project
  editOpen.value = true
}

// Quick status change
async function changeStatus({ project, status }) {
  try {
    await store.setStatus(project.id, status)
  } catch (err) {
    // surfaced via store.error
  }
}

// Delete confirm
const deleteOpen = ref(false)
const deleting = ref(false)
const deleteError = ref('')
function openDelete(project) {
  selectedProject.value = project
  deleteError.value = ''
  deleteOpen.value = true
}
async function confirmDelete() {
  if (deleting.value || !selectedProject.value) return
  deleting.value = true
  deleteError.value = ''
  try {
    await store.remove(selectedProject.value.id)
    deleteOpen.value = false
  } catch (err) {
    deleteError.value = err?.response?.data?.error?.message || err.message || 'Failed to delete project'
  } finally {
    deleting.value = false
  }
}
</script>

<template>
  <section class="p-4 sm:p-6 lg:p-8">
    <div class="flex items-center justify-between gap-3 mb-4">
      <div>
        <h2 class="text-lg font-semibold">Projects</h2>
        <p class="text-sm text-ink-500">
          <span v-if="loading">Loading…</span>
          <span v-else>{{ projects.length }} total</span>
        </p>
      </div>
      <button v-if="auth.can('projects.manage')" @click="openCreate" class="px-3 py-2 rounded-md bg-brand-500 text-white text-sm font-semibold flex items-center gap-1.5 hover:bg-brand-600">
        <Plus class="w-4 h-4" /> <span class="hidden sm:inline">New project</span>
      </button>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <ProjectCard
        v-for="p in projects"
        :key="p.id"
        :project="p"
        @edit="openEdit"
        @teams="openTeams"
        @status="changeStatus"
        @delete="openDelete"
      />
    </div>

    <CreateProjectDialog
      :open="createOpen"
      @update:open="onDialogOpen"
      @created="store.fetchList()"
    />

    <EditProjectDialog
      :open="editOpen"
      :project="selectedProject"
      @update:open="(v) => (editOpen = v)"
      @saved="store.fetchList()"
    />

    <Dialog :open="deleteOpen" title="Delete project" size="sm" @update:open="(v) => (deleteOpen = v)">
      <div class="space-y-3">
        <div v-if="deleteError" class="p-2.5 rounded-md bg-rose-50 border border-rose-200 text-xs text-rose-700">{{ deleteError }}</div>
        <p class="text-sm text-ink-700">
          Delete <span class="font-semibold">{{ selectedProject?.name }}</span>? This cannot be undone.
        </p>
      </div>
      <template #footer>
        <button @click="deleteOpen = false" type="button" class="px-3 py-1.5 rounded-md border border-cream-300 hover:bg-cream-50 text-sm">Cancel</button>
        <button @click="confirmDelete" :disabled="deleting" class="px-3 py-1.5 rounded-md bg-rose-500 hover:bg-rose-600 disabled:opacity-60 text-white text-sm font-semibold">{{ deleting ? 'Deleting…' : 'Delete' }}</button>
      </template>
    </Dialog>
  </section>
</template>

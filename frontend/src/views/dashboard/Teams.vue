<script setup>
import { ref, onMounted, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useRoute, useRouter } from 'vue-router'
import { Plus } from '@lucide/vue'
import TeamCard from '@/components/dashboard/TeamCard.vue'
import EmptyCreateCard from '@/components/dashboard/EmptyCreateCard.vue'
import CreateTeamDialog from '@/components/forms/CreateTeamDialog.vue'
import EditTeamDialog from '@/components/forms/EditTeamDialog.vue'
import ManageTeamMembersDialog from '@/components/forms/ManageTeamMembersDialog.vue'
import Dialog from '@/components/ui/Dialog.vue'
import { useTeamsStore } from '@/stores/teams'
import { useAuthStore } from '@/stores/auth'

const route = useRoute()
const router = useRouter()
const store = useTeamsStore()
const auth = useAuthStore()
const { list: teams, loading } = storeToRefs(store)
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

// Edit
const editOpen = ref(false)
const selectedTeam = ref(null)
function openEdit(team) {
  selectedTeam.value = team
  editOpen.value = true
}

// Manage members
const membersOpen = ref(false)
function openMembers(team) {
  selectedTeam.value = team
  membersOpen.value = true
}

// Delete confirm
const deleteOpen = ref(false)
const deleting = ref(false)
const deleteError = ref('')
function openDelete(team) {
  selectedTeam.value = team
  deleteError.value = ''
  deleteOpen.value = true
}
async function confirmDelete() {
  if (deleting.value || !selectedTeam.value) return
  deleting.value = true
  deleteError.value = ''
  try {
    await store.remove(selectedTeam.value.id)
    deleteOpen.value = false
  } catch (err) {
    deleteError.value = err?.response?.data?.error?.message || err.message || 'Failed to delete team'
  } finally {
    deleting.value = false
  }
}
</script>

<template>
  <section class="p-4 sm:p-6 lg:p-8">
    <div class="flex items-center justify-between gap-3 mb-4">
      <div>
        <h2 class="text-lg font-semibold">Teams</h2>
        <p class="text-sm text-ink-500">
          <span v-if="loading">Loading…</span>
          <span v-else>{{ teams.length }} total</span>
        </p>
      </div>
      <button v-if="auth.can('teams.manage')" @click="openCreate" class="px-3 py-2 rounded-md bg-brand-500 text-white text-sm font-semibold flex items-center gap-1.5 hover:bg-brand-600">
        <Plus class="w-4 h-4" /> <span class="hidden sm:inline">New team</span>
      </button>
    </div>

    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      <TeamCard
        v-for="t in teams"
        :key="t.id"
        :team="t"
        @edit="openEdit"
        @members="openMembers"
        @delete="openDelete"
      />
      <EmptyCreateCard v-if="auth.can('teams.manage')" label="Create new team" @click="openCreate" />
    </div>

    <CreateTeamDialog
      :open="createOpen"
      @update:open="onDialogOpen"
      @created="store.fetchList()"
    />

    <EditTeamDialog
      :open="editOpen"
      :team="selectedTeam"
      @update:open="(v) => (editOpen = v)"
      @saved="store.fetchList()"
    />

    <ManageTeamMembersDialog
      :open="membersOpen"
      :team="selectedTeam"
      @update:open="(v) => (membersOpen = v)"
      @saved="store.fetchList()"
    />

    <Dialog :open="deleteOpen" title="Delete team" size="sm" @update:open="(v) => (deleteOpen = v)">
      <div class="space-y-3">
        <div v-if="deleteError" class="p-2.5 rounded-md bg-rose-50 border border-rose-200 text-xs text-rose-700">{{ deleteError }}</div>
        <p class="text-sm text-ink-700">
          Delete <span class="font-semibold">{{ selectedTeam?.name }}</span>? This cannot be undone.
        </p>
      </div>
      <template #footer>
        <button @click="deleteOpen = false" type="button" class="px-3 py-1.5 rounded-md border border-cream-300 hover:bg-cream-50 text-sm">Cancel</button>
        <button @click="confirmDelete" :disabled="deleting" class="px-3 py-1.5 rounded-md bg-rose-500 hover:bg-rose-600 disabled:opacity-60 text-white text-sm font-semibold">{{ deleting ? 'Deleting…' : 'Delete' }}</button>
      </template>
    </Dialog>
  </section>
</template>

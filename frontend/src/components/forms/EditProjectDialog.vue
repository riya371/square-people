<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { storeToRefs } from 'pinia'
import { X } from '@lucide/vue'
import Dialog from '@/components/ui/Dialog.vue'
import { useProjectsStore } from '@/stores/projects'
import { useTeamsStore } from '@/stores/teams'

const props = defineProps({
  open: { type: Boolean, default: false },
  project: { type: Object, default: null },
})
const emit = defineEmits(['update:open', 'saved'])

const projectsStore = useProjectsStore()
const teamsStore = useTeamsStore()
const { list: allTeams } = storeToRefs(teamsStore)

const name = ref('')
const description = ref('')
const status = ref('on-track')
const dueDate = ref('')
const linkedTeams = ref([])     // [{ id, name }]
const selected = ref({})        // { [teamId]: true } to add
const submitting = ref(false)
const removingId = ref(null)
const error = ref('')

const linkedIds = computed(() => linkedTeams.value.map((t) => String(t.id)))
const addableTeams = computed(() =>
  allTeams.value.filter((t) => !linkedIds.value.includes(String(t.id)))
)

async function fill() {
  const p = props.project
  if (!p) return
  name.value = p.name || ''
  description.value = p.description || ''
  status.value = p.status || 'on-track'
  dueDate.value = p.dueDateRaw || ''
  error.value = ''
  submitting.value = false
  removingId.value = null
  selected.value = {}
  linkedTeams.value = (p.teams || []).map((t) => ({ id: String(t.id), name: t.name }))
  const fresh = await projectsStore.fetchOne(p.id)
  if (fresh) linkedTeams.value = (fresh.teams || []).map((t) => ({ id: String(t.id), name: t.name }))
}

onMounted(() => {
  if (!allTeams.value.length) teamsStore.fetchList()
})

watch(() => props.open, (v) => {
  if (v) {
    if (!allTeams.value.length) teamsStore.fetchList()
    fill()
  }
})
watch(() => props.project, () => { if (props.open) fill() })

async function unlink(id) {
  if (removingId.value) return
  error.value = ''
  removingId.value = id
  try {
    await projectsStore.removeTeam(props.project.id, id)
    linkedTeams.value = linkedTeams.value.filter((t) => String(t.id) !== String(id))
    emit('saved')
  } catch (err) {
    error.value = err?.response?.data?.error?.message || err.message || 'Failed to unlink team'
  } finally {
    removingId.value = null
  }
}

async function submit() {
  if (submitting.value) return
  error.value = ''
  submitting.value = true
  try {
    const payload = {
      name: name.value.trim(),
      status: status.value,
      description: description.value.trim(),
    }
    if (dueDate.value) payload.dueDate = dueDate.value
    await projectsStore.update(props.project.id, payload)

    const toAdd = Object.entries(selected.value).filter(([, v]) => v).map(([id]) => Number(id))
    if (toAdd.length) {
      const merged = Array.from(new Set([...linkedIds.value.map(Number), ...toAdd]))
      await projectsStore.setTeams(props.project.id, merged)
    }

    emit('update:open', false)
    emit('saved')
  } catch (err) {
    error.value = err?.response?.data?.error?.message || err.message || 'Failed to update project'
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <Dialog :open="open" title="Edit project" @update:open="(v) => emit('update:open', v)">
    <form @submit.prevent="submit" class="space-y-3">
      <div v-if="error" class="p-2.5 rounded-md bg-rose-50 border border-rose-200 text-xs text-rose-700">{{ error }}</div>
      <div>
        <label class="block text-xs font-medium text-ink-700 mb-1">Name<span class="text-rose-500">*</span></label>
        <input v-model="name" required type="text" class="w-full px-3 py-2 rounded-md border border-cream-300 bg-white text-sm focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20" />
      </div>
      <div>
        <label class="block text-xs font-medium text-ink-700 mb-1">Description</label>
        <textarea v-model="description" rows="3" class="w-full px-3 py-2 rounded-md border border-cream-300 bg-white text-sm focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20" />
      </div>
      <div>
        <label class="block text-xs font-medium text-ink-700 mb-1">Status</label>
        <select v-model="status" class="w-full px-3 py-2 rounded-md border border-cream-300 bg-white text-sm focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20">
          <option value="on-track">On track</option>
          <option value="at-risk">At risk</option>
          <option value="in-progress">In progress</option>
          <option value="completed">Completed</option>
        </select>
      </div>
      <div>
        <label class="block text-xs font-medium text-ink-700 mb-1">Due date</label>
        <input v-model="dueDate" type="date" class="w-full px-3 py-2 rounded-md border border-cream-300 bg-white text-sm focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20" />
      </div>

      <div>
        <label class="block text-xs font-medium text-ink-700 mb-1">Linked teams</label>
        <div v-if="!linkedTeams.length" class="text-sm text-ink-500 mb-2">No teams linked.</div>
        <div v-else class="flex flex-wrap gap-1.5 mb-2">
          <span
            v-for="t in linkedTeams"
            :key="t.id"
            class="inline-flex items-center gap-1 pl-2.5 pr-1 py-1 rounded-full bg-cream-100 text-xs text-ink-700"
          >
            {{ t.name }}
            <button type="button" @click="unlink(t.id)" :disabled="removingId === t.id" class="p-0.5 rounded-full hover:bg-rose-100 disabled:opacity-50" aria-label="Unlink team">
              <X class="w-3 h-3 text-rose-500" />
            </button>
          </span>
        </div>
        <div v-if="addableTeams.length" class="space-y-1 max-h-40 overflow-y-auto border border-cream-200 rounded-md p-1">
          <label
            v-for="t in addableTeams"
            :key="t.id"
            class="flex items-center gap-3 p-2 rounded-md hover:bg-cream-50 cursor-pointer"
          >
            <input type="checkbox" :value="t.id" v-model="selected[t.id]" />
            <span class="text-sm flex-1">{{ t.name }}</span>
          </label>
        </div>
      </div>
    </form>
    <template #footer>
      <button @click="emit('update:open', false)" type="button" class="px-3 py-1.5 rounded-md border border-cream-300 hover:bg-cream-50 text-sm">Cancel</button>
      <button @click="submit" :disabled="submitting" class="px-3 py-1.5 rounded-md bg-brand-500 hover:bg-brand-600 disabled:opacity-60 text-white text-sm font-semibold">{{ submitting ? 'Saving…' : 'Save' }}</button>
    </template>
  </Dialog>
</template>

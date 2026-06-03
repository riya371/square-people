<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { storeToRefs } from 'pinia'
import { X } from '@lucide/vue'
import Dialog from '@/components/ui/Dialog.vue'
import { useTeamsStore } from '@/stores/teams'
import { useEmployeesStore } from '@/stores/employees'

const props = defineProps({
  open: { type: Boolean, default: false },
  team: { type: Object, default: null },
})
const emit = defineEmits(['update:open', 'saved'])

const teamsStore = useTeamsStore()
const employeesStore = useEmployeesStore()
const { list: employees } = storeToRefs(employeesStore)

const members = ref([])        // [{ id, name }]
const selected = ref({})       // { [employeeId]: true } for adding
const submitting = ref(false)
const removingId = ref(null)
const error = ref('')

const memberIds = computed(() => members.value.map((m) => String(m.id)))
const addableEmployees = computed(() =>
  employees.value.filter((e) => !memberIds.value.includes(String(e.id)))
)

async function load() {
  error.value = ''
  selected.value = {}
  submitting.value = false
  removingId.value = null
  if (!props.team) return
  members.value = (props.team.members || []).map((m) => ({ id: String(m.id), name: m.name }))
  const fresh = await teamsStore.fetchOne(props.team.id)
  if (fresh) members.value = (fresh.members || []).map((m) => ({ id: String(m.id), name: m.name }))
}

onMounted(() => {
  if (!employees.value.length) employeesStore.fetchList({ perPage: 100 })
})

watch(() => props.open, (v) => {
  if (v) {
    if (!employees.value.length) employeesStore.fetchList({ perPage: 100 })
    load()
  }
})

async function removeOne(id) {
  if (removingId.value) return
  error.value = ''
  removingId.value = id
  try {
    await teamsStore.removeMember(props.team.id, id)
    members.value = members.value.filter((m) => String(m.id) !== String(id))
    emit('saved')
  } catch (err) {
    error.value = err?.response?.data?.error?.message || err.message || 'Failed to remove member'
  } finally {
    removingId.value = null
  }
}

async function addSelected() {
  if (submitting.value) return
  const toAdd = Object.entries(selected.value).filter(([, v]) => v).map(([id]) => Number(id))
  if (!toAdd.length) { emit('update:open', false); return }
  error.value = ''
  submitting.value = true
  try {
    const merged = Array.from(new Set([...memberIds.value.map(Number), ...toAdd]))
    await teamsStore.setMembers(props.team.id, merged)
    emit('update:open', false)
    emit('saved')
  } catch (err) {
    error.value = err?.response?.data?.error?.message || err.message || 'Failed to add members'
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <Dialog :open="open" :title="`Members — ${team?.name || ''}`" @update:open="(v) => emit('update:open', v)">
    <div class="space-y-4">
      <div v-if="error" class="p-2.5 rounded-md bg-rose-50 border border-rose-200 text-xs text-rose-700">{{ error }}</div>

      <div>
        <p class="text-xs font-medium text-ink-700 mb-1.5">Current members</p>
        <div v-if="!members.length" class="text-sm text-ink-500">No members yet.</div>
        <div v-else class="space-y-1">
          <div
            v-for="m in members"
            :key="m.id"
            class="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-md bg-cream-50"
          >
            <span class="text-sm">{{ m.name }}</span>
            <button
              type="button"
              @click="removeOne(m.id)"
              :disabled="removingId === m.id"
              class="p-1 rounded hover:bg-rose-50 disabled:opacity-50"
              aria-label="Remove member"
            >
              <X class="w-4 h-4 text-rose-500" />
            </button>
          </div>
        </div>
      </div>

      <div>
        <p class="text-xs font-medium text-ink-700 mb-1.5">Add members</p>
        <div v-if="!addableEmployees.length" class="text-sm text-ink-500">All employees are already members.</div>
        <div v-else class="space-y-1 max-h-56 overflow-y-auto">
          <label
            v-for="e in addableEmployees"
            :key="e.id"
            class="flex items-center gap-3 p-2 rounded-md hover:bg-cream-50 cursor-pointer"
          >
            <input type="checkbox" :value="e.id" v-model="selected[e.id]" />
            <span class="text-sm flex-1">{{ e.name }}</span>
          </label>
        </div>
      </div>
    </div>
    <template #footer>
      <button @click="emit('update:open', false)" type="button" class="px-3 py-1.5 rounded-md border border-cream-300 hover:bg-cream-50 text-sm">Close</button>
      <button @click="addSelected" :disabled="submitting" class="px-3 py-1.5 rounded-md bg-brand-500 hover:bg-brand-600 disabled:opacity-60 text-white text-sm font-semibold">{{ submitting ? 'Saving…' : 'Add selected' }}</button>
    </template>
  </Dialog>
</template>

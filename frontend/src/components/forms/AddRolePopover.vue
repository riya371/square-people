<script setup>
import { ref, computed, watch } from 'vue'
import { storeToRefs } from 'pinia'
import Dialog from '@/components/ui/Dialog.vue'
import { useRolesStore } from '@/stores/roles'
import { useEmployeesStore } from '@/stores/employees'

const props = defineProps({
  open: { type: Boolean, default: false },
  employeeId: { type: [String, Number], default: null },
})
const emit = defineEmits(['update:open', 'assigned'])

const rolesStore = useRolesStore()
const employeesStore = useEmployeesStore()
const { list: roles, loading } = storeToRefs(rolesStore)

const selected = ref({}) // { [roleId]: true }
const submitting = ref(false)
const error = ref('')

const currentRoleIds = computed(() => {
  const emp = employeesStore.byId[String(props.employeeId)]
  if (!emp) return []
  return (emp.roles || []).map((r) => r.id)
})

watch(() => props.open, (v) => {
  if (v) {
    selected.value = {}
    error.value = ''
    submitting.value = false
    if (!roles.value.length) rolesStore.fetchList()
  }
})

async function submit() {
  if (submitting.value) return
  error.value = ''
  submitting.value = true
  try {
    const newlyChecked = Object.entries(selected.value)
      .filter(([, v]) => v)
      .map(([id]) => Number(id))
    const merged = Array.from(new Set([...currentRoleIds.value, ...newlyChecked]))
    await employeesStore.assignRoles(props.employeeId, merged)
    emit('update:open', false)
    emit('assigned')
  } catch (err) {
    error.value = err?.response?.data?.error?.message || err.message || 'Failed to assign roles'
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <Dialog :open="open" title="Add roles" @update:open="(v) => emit('update:open', v)" size="sm">
    <div class="space-y-3">
      <div v-if="error" class="p-2.5 rounded-md bg-rose-50 border border-rose-200 text-xs text-rose-700">{{ error }}</div>
      <div v-if="loading && !roles.length" class="text-sm text-ink-500">Loading…</div>
      <div v-else-if="!roles.length" class="text-sm text-ink-500">No roles available.</div>
      <div v-else class="space-y-1.5 max-h-72 overflow-y-auto">
        <label
          v-for="r in roles"
          :key="r.id"
          class="flex items-center gap-3 p-2 rounded-md hover:bg-cream-50 cursor-pointer"
        >
          <input
            type="checkbox"
            :value="r.id"
            v-model="selected[r.id]"
            :disabled="currentRoleIds.includes(r.id)"
          />
          <span class="text-sm flex-1">{{ r.name }}</span>
          <span v-if="currentRoleIds.includes(r.id)" class="text-xs text-ink-500">Assigned</span>
        </label>
      </div>
    </div>
    <template #footer>
      <button @click="emit('update:open', false)" type="button" class="px-3 py-1.5 rounded-md border border-cream-300 hover:bg-cream-50 text-sm">Cancel</button>
      <button @click="submit" :disabled="submitting" class="px-3 py-1.5 rounded-md bg-brand-500 hover:bg-brand-600 disabled:opacity-60 text-white text-sm font-semibold">{{ submitting ? 'Saving…' : 'Add' }}</button>
    </template>
  </Dialog>
</template>

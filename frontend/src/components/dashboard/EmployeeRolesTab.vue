<script setup>
import RoleChip from './RoleChip.vue'
import { useEmployeesStore } from '@/stores/employees'

const props = defineProps({
  employee: { type: Object, required: true },
})
const emit = defineEmits(['add-role', 'changed'])

const store = useEmployeesStore()

async function removeRole(role) {
  if (!window.confirm(`Remove the "${role.label}" role from ${props.employee.name}?`)) return
  await store.removeRole(props.employee.id, role.id)
  emit('changed')
}
</script>

<template>
  <div class="bg-white rounded-lg border border-cream-200 p-5">
    <h3 class="font-semibold mb-3">Roles</h3>
    <div class="flex flex-wrap gap-2">
      <RoleChip
        v-for="r in employee.roles"
        :key="r.id ?? r.label"
        :tone="r.tone"
        removable
        @remove="removeRole(r)"
      >{{ r.label }}</RoleChip>
      <button
        @click="$emit('add-role')"
        class="text-xs px-2 py-1 rounded-full border border-dashed border-cream-300 text-ink-500 hover:bg-cream-100"
      >+ Add role</button>
    </div>
  </div>
</template>

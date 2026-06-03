<script setup>
import { ref, watch, toRef } from 'vue'
import { Mail, Phone, Calendar, Edit, Hash } from '@lucide/vue'
import Avatar from '@/components/dashboard/Avatar.vue'
import StatusPill from '@/components/dashboard/StatusPill.vue'
import RoleChip from '@/components/dashboard/RoleChip.vue'
import EmployeeTabs from '@/components/dashboard/EmployeeTabs.vue'
import EmployeeTasksTab from '@/components/dashboard/EmployeeTasksTab.vue'
import EmployeeAttendanceTab from '@/components/dashboard/EmployeeAttendanceTab.vue'
import EmployeeLeavesTab from '@/components/dashboard/EmployeeLeavesTab.vue'
import EmployeeTeamsTab from '@/components/dashboard/EmployeeTeamsTab.vue'
import EmployeeRolesTab from '@/components/dashboard/EmployeeRolesTab.vue'
import EditEmployeeDialog from '@/components/forms/EditEmployeeDialog.vue'
import AddRolePopover from '@/components/forms/AddRolePopover.vue'
import { useEmployeesStore } from '@/stores/employees'

const props = defineProps({ id: { type: String, required: true } })
const store = useEmployeesStore()
const employee = ref(null)

async function load(id) {
  employee.value = await store.fetchOne(id)
}

watch(toRef(props, 'id'), (id) => load(id), { immediate: true })

const tab = ref('profile')
const tabs = [
  { key: 'profile', label: 'Profile' },
  { key: 'roles',   label: 'Roles' },
  { key: 'teams',   label: 'Teams' },
  { key: 'tasks',   label: 'Tasks' },
  { key: 'attendance', label: 'Attendance' },
  { key: 'leaves',  label: 'Leaves' },
]

const editOpen = ref(false)
const addRoleOpen = ref(false)

function statusLabel(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : ''
}

function onEditSaved() {
  load(props.id)
}
function onRoleAssigned() {
  load(props.id)
}
</script>

<template>
  <section v-if="employee" class="p-4 sm:p-6 lg:p-8">
    <div class="flex flex-wrap items-start gap-6 mb-6">
      <Avatar :initials="employee.avatar.initials" :gradient="employee.avatar.gradient" size="xl" />
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-3 mb-1 flex-wrap">
          <h2 class="text-2xl font-semibold">{{ employee.name }}</h2>
          <StatusPill :tone="employee.status">{{ statusLabel(employee.status) }}</StatusPill>
        </div>
        <p class="text-sm text-ink-500">{{ employee.roles[0]?.label }} · {{ employee.department }} · Square Feet LTD</p>
        <div class="flex flex-wrap gap-x-4 gap-y-1 mt-3 text-sm text-ink-600">
          <span class="flex items-center gap-1.5"><Mail class="w-4 h-4" />{{ employee.email }}</span>
          <span v-if="employee.phone" class="flex items-center gap-1.5"><Phone class="w-4 h-4" />{{ employee.phone }}</span>
          <span class="flex items-center gap-1.5"><Calendar class="w-4 h-4" />Joined {{ employee.hireDate }}</span>
          <span class="flex items-center gap-1.5">
            <Hash class="w-4 h-4" />
            <span v-if="employee.employeeCode" class="font-mono">{{ employee.employeeCode }}</span>
            <button v-else @click="editOpen = true" class="text-amber-700 underline hover:text-amber-800">
              No employee code — set one to enable kiosk PIN sign-in
            </button>
          </span>
        </div>
      </div>
      <button @click="editOpen = true" class="px-3 py-2 rounded-md border border-cream-200 text-sm flex items-center gap-1.5 hover:bg-cream-100">
        <Edit class="w-4 h-4" /> Edit
      </button>
    </div>

    <EmployeeTabs :tabs="tabs" v-model="tab" />

    <div v-if="tab === 'profile'" class="grid grid-cols-1 md:grid-cols-3 gap-4">
      <div class="bg-white p-5 rounded-lg border border-cream-200">
        <h3 class="font-semibold mb-3">Roles</h3>
        <div class="flex flex-wrap gap-2">
          <RoleChip v-for="r in employee.roles" :key="r.label" :tone="r.tone">{{ r.label }}</RoleChip>
          <button
            @click="addRoleOpen = true"
            class="text-xs px-2 py-1 rounded-full border border-dashed border-cream-300 text-ink-500 hover:bg-cream-100"
          >+ Add role</button>
        </div>
      </div>
      <div class="bg-white p-5 rounded-lg border border-cream-200">
        <h3 class="font-semibold mb-3">Teams led</h3>
        <ul v-if="employee.teamsLed.length" class="text-sm space-y-2">
          <li v-for="t in employee.teamsLed" :key="t.name" class="flex items-center justify-between">
            <span>{{ t.name }}</span>
            <span class="text-xs text-ink-500">{{ t.members }} members</span>
          </li>
        </ul>
        <p v-else class="text-sm text-ink-500">None.</p>
      </div>
      <div class="bg-white p-5 rounded-lg border border-cream-200">
        <h3 class="font-semibold mb-3">This month</h3>
        <ul class="text-sm space-y-2 text-ink-600">
          <li class="flex justify-between"><span>Hours logged</span><span class="font-medium text-ink-900">{{ employee.stats.hoursThisMonth }}h</span></li>
          <li class="flex justify-between"><span>Days present</span><span class="font-medium text-ink-900">{{ employee.stats.daysPresent }} / {{ employee.stats.daysExpected }}</span></li>
          <li class="flex justify-between"><span>Tasks completed</span><span class="font-medium text-ink-900">{{ employee.stats.tasksCompleted }}</span></li>
        </ul>
      </div>
    </div>

    <div v-else-if="tab === 'tasks'">
      <EmployeeTasksTab :employee-id="id" />
    </div>
    <div v-else-if="tab === 'attendance'">
      <EmployeeAttendanceTab :employee-id="id" />
    </div>
    <div v-else-if="tab === 'leaves'">
      <EmployeeLeavesTab :employee-id="id" />
    </div>
    <div v-else-if="tab === 'teams'">
      <EmployeeTeamsTab :employee="employee" />
    </div>
    <div v-else-if="tab === 'roles'">
      <EmployeeRolesTab :employee="employee" @add-role="addRoleOpen = true" @changed="load(id)" />
    </div>

    <EditEmployeeDialog
      :open="editOpen"
      :employee="employee"
      @update:open="(v) => editOpen = v"
      @saved="onEditSaved"
    />
    <AddRolePopover
      :open="addRoleOpen"
      :employee-id="id"
      @update:open="(v) => addRoleOpen = v"
      @assigned="onRoleAssigned"
    />
  </section>

  <section v-else class="p-8 text-sm text-ink-500">Loading employee…</section>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useRoute, useRouter } from 'vue-router'
import { Filter, Plus } from '@lucide/vue'
import Avatar from '@/components/dashboard/Avatar.vue'
import RoleChip from '@/components/dashboard/RoleChip.vue'
import StatusPill from '@/components/dashboard/StatusPill.vue'
import DataTable from '@/components/dashboard/DataTable.vue'
import Pagination from '@/components/dashboard/Pagination.vue'
import CreateEmployeeDialog from '@/components/forms/CreateEmployeeDialog.vue'
import { useEmployeesStore } from '@/stores/employees'
import { useAuthStore } from '@/stores/auth'

const route = useRoute()
const router = useRouter()
const store = useEmployeesStore()
const auth = useAuthStore()
const { list: employees, loading } = storeToRefs(store)

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

onMounted(() => store.fetchList({ perPage: 50 }))

// Local pagination over the store-backed list. `filtered` is a passthrough for now
// (server-side filtering can replace this later via fetchList params).
const filtered = computed(() => employees.value)
const page = ref(1)
const pageSize = 30
const pageCount = computed(() => Math.max(1, Math.ceil(filtered.value.length / pageSize)))
const pageItems = computed(() => filtered.value.slice((page.value - 1) * pageSize, page.value * pageSize))
function open(id) { router.push({ name: 'employee-detail', params: { id } }) }
function statusLabel(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : '' }
</script>

<template>
  <section class="p-4 sm:p-6 lg:p-8">
    <div class="flex items-center justify-between gap-3 mb-4">
      <div>
        <h2 class="text-lg font-semibold">All employees</h2>
        <p class="text-sm text-ink-500">{{ employees.length }} total · {{ filtered.length }} matching</p>
      </div>
      <div class="flex gap-2">
        <button class="px-3 py-2 rounded-md border border-cream-200 text-sm flex items-center gap-1.5 hover:bg-cream-100">
          <Filter class="w-4 h-4" /> <span class="hidden sm:inline">Filter</span>
        </button>
        <button v-if="auth.can('employees.manage')" @click="openCreate" class="px-3 py-2 rounded-md bg-brand-500 text-white text-sm font-semibold flex items-center gap-1.5 hover:bg-brand-600">
          <Plus class="w-4 h-4" /> <span class="hidden sm:inline">Add employee</span>
        </button>
      </div>
    </div>

    <DataTable :rows="pageItems">
      <template #head>
        <th class="px-4 py-3 font-medium">Name</th>
        <th class="px-4 py-3 font-medium">Department</th>
        <th class="px-4 py-3 font-medium">Roles</th>
        <th class="px-4 py-3 font-medium">Status</th>
        <th class="px-4 py-3 font-medium">Hire date</th>
        <th class="px-4 py-3"></th>
      </template>
      <template #default>
        <tr v-for="e in pageItems" :key="e.id" class="hover:bg-cream-100 cursor-pointer" @click="open(e.id)">
          <td class="px-4 py-3">
            <div class="flex items-center gap-3">
              <Avatar :initials="e.avatar.initials" :gradient="e.avatar.gradient" />
              <div>
                <div class="font-medium">{{ e.name }}</div>
                <div class="text-xs text-ink-500">{{ e.email }}</div>
              </div>
            </div>
          </td>
          <td class="px-4 py-3">{{ e.department }}</td>
          <td class="px-4 py-3 space-x-1">
            <RoleChip v-for="r in e.roles" :key="r.label" :tone="r.tone">{{ r.label }}</RoleChip>
          </td>
          <td class="px-4 py-3">
            <StatusPill :tone="e.status" dot>{{ statusLabel(e.status) }}</StatusPill>
          </td>
          <td class="px-4 py-3 text-ink-500">{{ e.hireDate }}</td>
          <td class="px-4 py-3 text-right text-ink-500/60">›</td>
        </tr>
      </template>
      <template #mobileRow="{ row: e }">
        <div class="p-4 flex items-start gap-3 hover:bg-cream-100" @click="open(e.id)">
          <Avatar :initials="e.avatar.initials" :gradient="e.avatar.gradient" />
          <div class="flex-1 min-w-0">
            <div class="flex items-center justify-between gap-2">
              <div class="font-medium truncate">{{ e.name }}</div>
              <StatusPill :tone="e.status" dot>{{ statusLabel(e.status) }}</StatusPill>
            </div>
            <div class="text-xs text-ink-500 truncate">{{ e.email }} · {{ e.department }}</div>
            <div class="mt-1 space-x-1">
              <RoleChip v-for="r in e.roles" :key="r.label" :tone="r.tone">{{ r.label }}</RoleChip>
            </div>
          </div>
        </div>
      </template>
      <template #footer>
        <Pagination :page="page" :page-count="pageCount" :total="filtered.length" :page-size="pageSize" @update:page="(p) => page = p" />
      </template>
    </DataTable>

    <CreateEmployeeDialog
      :open="createOpen"
      @update:open="onDialogOpen"
      @created="store.fetchList({ perPage: 50 })"
    />
  </section>
</template>

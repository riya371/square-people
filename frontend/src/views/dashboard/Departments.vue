<script setup>
import { ref, onMounted, onUnmounted, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useRoute, useRouter } from 'vue-router'
import { MoreHorizontal, Plus, Pencil, Trash2 } from '@lucide/vue'
import DataTable from '@/components/dashboard/DataTable.vue'
import CreateDepartmentDialog from '@/components/forms/CreateDepartmentDialog.vue'
import EditDepartmentDialog from '@/components/forms/EditDepartmentDialog.vue'
import { useDepartmentsStore } from '@/stores/departments'

const route = useRoute()
const router = useRouter()
const store = useDepartmentsStore()
const { list: departments, loading } = storeToRefs(store)
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

// --- Row actions menu (edit / delete) ---
const menuFor = ref(null)        // department id whose menu is open
const editOpen = ref(false)
const editing = ref(null)

function toggleMenu(id) {
  menuFor.value = menuFor.value === id ? null : id
}
function closeMenu() { menuFor.value = null }

function openEdit(d) {
  editing.value = d
  editOpen.value = true
  closeMenu()
}
async function removeDepartment(d) {
  closeMenu()
  if (!window.confirm(`Delete the "${d.name}" department? This cannot be undone.`)) return
  await store.remove(d.id)
}

onMounted(() => window.addEventListener('click', closeMenu))
onUnmounted(() => window.removeEventListener('click', closeMenu))
</script>

<template>
  <section class="p-4 sm:p-6 lg:p-8">
    <div class="flex items-center justify-between gap-3 mb-4">
      <div>
        <h2 class="text-lg font-semibold">Departments</h2>
        <p class="text-sm text-ink-500">{{ departments.length }} total</p>
      </div>
      <button @click="openCreate" class="px-3 py-2 rounded-md bg-brand-500 text-white text-sm font-semibold flex items-center gap-1.5 hover:bg-brand-600">
        <Plus class="w-4 h-4" /> <span class="hidden sm:inline">Add department</span>
      </button>
    </div>

    <DataTable :rows="departments">
      <template #head>
        <th class="px-4 py-3 font-medium">Name</th>
        <th class="px-4 py-3 font-medium">Description</th>
        <th class="px-4 py-3 font-medium">Headcount</th>
        <th class="px-4 py-3"></th>
      </template>
      <template #default>
        <tr v-for="d in departments" :key="d.id" class="hover:bg-cream-100">
          <td class="px-4 py-3 font-medium">{{ d.name }}</td>
          <td class="px-4 py-3 text-ink-600">{{ d.description }}</td>
          <td class="px-4 py-3">{{ d.headcount }}</td>
          <td class="px-4 py-3 text-right">
            <div class="relative inline-block text-left">
              <button
                type="button"
                @click.stop="toggleMenu(d.id)"
                class="p-1 rounded hover:bg-cream-200 text-ink-500/60"
                aria-label="Department actions"
              >
                <MoreHorizontal class="w-4 h-4" />
              </button>
              <div
                v-if="menuFor === d.id"
                @click.stop
                class="absolute right-0 mt-1 w-36 rounded-md border border-cream-200 bg-white shadow-lg z-10 py-1 text-sm"
              >
                <button type="button" @click="openEdit(d)" class="w-full flex items-center gap-2 px-3 py-1.5 text-left hover:bg-cream-100">
                  <Pencil class="w-4 h-4 text-ink-500" /> Edit
                </button>
                <button type="button" @click="removeDepartment(d)" class="w-full flex items-center gap-2 px-3 py-1.5 text-left text-rose-600 hover:bg-rose-50">
                  <Trash2 class="w-4 h-4" /> Delete
                </button>
              </div>
            </div>
          </td>
        </tr>
      </template>
      <template #mobileRow="{ row: d }">
        <div class="p-4">
          <div class="flex items-center justify-between">
            <div class="font-medium">{{ d.name }}</div>
            <div class="text-sm text-ink-500">{{ d.headcount }}</div>
          </div>
          <div class="text-sm text-ink-500">{{ d.description }}</div>
          <div class="mt-2 flex gap-2">
            <button type="button" @click.stop="openEdit(d)" class="px-2 py-1 rounded-md border border-cream-200 text-xs flex items-center gap-1 hover:bg-cream-100">
              <Pencil class="w-3.5 h-3.5" /> Edit
            </button>
            <button type="button" @click.stop="removeDepartment(d)" class="px-2 py-1 rounded-md border border-rose-200 text-xs text-rose-600 flex items-center gap-1 hover:bg-rose-50">
              <Trash2 class="w-3.5 h-3.5" /> Delete
            </button>
          </div>
        </div>
      </template>
    </DataTable>

    <CreateDepartmentDialog
      :open="createOpen"
      @update:open="onDialogOpen"
      @created="store.fetchList()"
    />
    <EditDepartmentDialog
      :open="editOpen"
      :department="editing"
      @update:open="(v) => editOpen = v"
      @saved="store.fetchList()"
    />
  </section>
</template>

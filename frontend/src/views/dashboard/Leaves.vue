<script setup>
import { ref, onMounted, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useRoute, useRouter } from 'vue-router'
import { Plus } from '@lucide/vue'
import LeaveApprovalRow from '@/components/dashboard/LeaveApprovalRow.vue'
import LeaveRequestsTable from '@/components/dashboard/LeaveRequestsTable.vue'
import StatusPill from '@/components/dashboard/StatusPill.vue'
import RequestLeaveDialog from '@/components/forms/RequestLeaveDialog.vue'
import RejectLeaveDialog from '@/components/forms/RejectLeaveDialog.vue'
import { useLeavesStore } from '@/stores/leaves'

const route = useRoute()
const router = useRouter()
const store = useLeavesStore()
const { pending, mine } = storeToRefs(store)
onMounted(() => store.refresh())

const requestOpen = ref(false)
function openRequest() {
  requestOpen.value = true
  router.replace({ query: { ...route.query, create: '1' } })
}
function closeRequest() {
  requestOpen.value = false
  const { create, ...rest } = route.query
  router.replace({ query: rest })
}
function onRequestOpen(v) {
  if (v) requestOpen.value = true
  else closeRequest()
}

watch(() => route.query.create, (v) => {
  if (v === '1') requestOpen.value = true
}, { immediate: true })

const rejectOpen = ref(false)
const rejectingId = ref(null)
function openReject(id) {
  rejectingId.value = id
  rejectOpen.value = true
}
function handleReject(reason) {
  if (rejectingId.value != null) store.reject(rejectingId.value, reason)
  rejectingId.value = null
}

function handleCancel(id) {
  store.cancelMine(id)
}
</script>

<template>
  <section class="p-4 sm:p-6 lg:p-8">
    <div class="bg-white rounded-lg border border-cream-200 mb-6">
      <div class="px-5 py-4 border-b border-cream-200 flex items-center justify-between flex-wrap gap-2">
        <div>
          <h3 class="font-semibold">Pending approvals</h3>
          <p class="text-xs text-ink-500">Awaiting your decision</p>
        </div>
        <StatusPill tone="rejected">{{ pending.length }} pending</StatusPill>
      </div>
      <ul v-if="pending.length" class="divide-y divide-cream-200">
        <LeaveApprovalRow
          v-for="lv in pending"
          :key="lv.id"
          :leave="lv"
          @approve="store.approve(lv.id)"
          @reject="openReject(lv.id)"
        />
      </ul>
      <p v-else class="p-5 text-sm text-ink-500">No pending approvals.</p>
    </div>

    <div class="bg-white rounded-lg border border-cream-200">
      <div class="px-5 py-4 border-b border-cream-200 flex items-center justify-between">
        <h3 class="font-semibold">My requests</h3>
        <button @click="openRequest" class="px-3 py-1.5 rounded-md bg-brand-500 text-white text-sm font-semibold flex items-center gap-1.5 hover:bg-brand-600">
          <Plus class="w-4 h-4" /><span class="hidden sm:inline">Request leave</span>
        </button>
      </div>
      <LeaveRequestsTable :rows="mine" cancellable @cancel="handleCancel" />
    </div>

    <RequestLeaveDialog
      :open="requestOpen"
      @update:open="onRequestOpen"
      @created="store.refresh()"
    />
    <RejectLeaveDialog
      :open="rejectOpen"
      @update:open="(v) => rejectOpen = v"
      @reject="handleReject"
    />
  </section>
</template>

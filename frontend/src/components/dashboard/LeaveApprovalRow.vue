<script setup>
import Avatar from './Avatar.vue'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()

defineProps({
  leave: { type: Object, required: true },
})
defineEmits(['approve', 'reject'])

const TYPE_LABEL = { annual: 'Annual leave', sick: 'Sick leave', unpaid: 'Unpaid leave' }
</script>

<template>
  <li class="p-5 flex flex-col sm:flex-row sm:items-center gap-4">
    <div class="flex items-center gap-4 flex-1">
      <Avatar :initials="leave.employee.initials" :gradient="leave.employee.gradient" size="lg" />
      <div class="flex-1 min-w-0">
        <div class="font-medium">
          {{ leave.employee.name }}
          <span class="text-xs text-ink-500 font-normal">· {{ leave.employee.role }}</span>
        </div>
        <div class="text-sm text-ink-600">
          {{ leave.days }} day{{ leave.days === 1 ? '' : 's' }} · {{ TYPE_LABEL[leave.type] }} · {{ leave.startDate }}<span v-if="leave.endDate !== leave.startDate"> – {{ leave.endDate }}</span>
        </div>
        <div class="text-xs text-ink-500/60 mt-0.5">
          <span v-if="leave.reason">{{ leave.reason }} — </span>submitted {{ leave.submittedAt }}
        </div>
      </div>
    </div>
    <div v-if="auth.can('leaves.approve')" class="flex gap-2 sm:flex-shrink-0">
      <button
        class="flex-1 sm:flex-initial px-3 py-1.5 rounded-md border border-cream-200 text-sm hover:bg-cream-100"
        @click="$emit('reject', leave.id)"
      >Reject</button>
      <button
        class="flex-1 sm:flex-initial px-3 py-1.5 rounded-md bg-emerald-600 text-white text-sm hover:bg-emerald-700"
        @click="$emit('approve', leave.id)"
      >Approve</button>
    </div>
  </li>
</template>

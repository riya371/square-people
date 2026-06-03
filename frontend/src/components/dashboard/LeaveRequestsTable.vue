<script setup>
import DataTable from './DataTable.vue'
import StatusPill from './StatusPill.vue'
import RoleChip from './RoleChip.vue'

defineProps({
  rows: { type: Array, required: true },
  cancellable: { type: Boolean, default: false },
})
defineEmits(['cancel'])

const TYPE_TONE = { annual: 'brand', sick: 'rose', unpaid: 'cream', other: 'cream' }
const TYPE_LABEL = { annual: 'Annual', sick: 'Sick', unpaid: 'Unpaid', other: 'Other' }
</script>

<template>
  <DataTable :rows="rows">
    <template #head>
      <th class="px-5 py-3 font-medium">Type</th>
      <th class="px-5 py-3 font-medium">Dates</th>
      <th class="px-5 py-3 font-medium">Days</th>
      <th class="px-5 py-3 font-medium">Status</th>
      <th class="px-5 py-3 font-medium">Submitted</th>
      <th v-if="cancellable" class="px-5 py-3"></th>
    </template>
    <template #default>
      <tr v-for="r in rows" :key="r.id">
        <td class="px-5 py-3"><RoleChip :tone="TYPE_TONE[r.type]">{{ TYPE_LABEL[r.type] || r.type }}</RoleChip></td>
        <td class="px-5 py-3">{{ r.startDate }}<span v-if="r.endDate !== r.startDate"> – {{ r.endDate }}</span></td>
        <td class="px-5 py-3">{{ r.days }}</td>
        <td class="px-5 py-3"><StatusPill :tone="r.status">{{ r.status.charAt(0).toUpperCase() + r.status.slice(1) }}</StatusPill></td>
        <td class="px-5 py-3 text-ink-500">{{ r.submittedAt }}</td>
        <td v-if="cancellable" class="px-5 py-3 text-right">
          <button
            v-if="r.status === 'pending'"
            @click="$emit('cancel', r.id)"
            class="text-xs px-2 py-1 rounded-md border border-cream-300 hover:bg-cream-100"
          >Cancel</button>
        </td>
      </tr>
    </template>
    <template #mobileRow="{ row: r }">
      <div class="p-4">
        <div class="flex justify-between gap-2">
          <RoleChip :tone="TYPE_TONE[r.type]">{{ TYPE_LABEL[r.type] || r.type }}</RoleChip>
          <StatusPill :tone="r.status">{{ r.status.charAt(0).toUpperCase() + r.status.slice(1) }}</StatusPill>
        </div>
        <div class="text-sm text-ink-600 mt-2">{{ r.startDate }}<span v-if="r.endDate !== r.startDate"> – {{ r.endDate }}</span> · {{ r.days }}d</div>
        <div class="text-xs text-ink-500 mt-1">Submitted {{ r.submittedAt }}</div>
        <div v-if="cancellable && r.status === 'pending'" class="mt-2">
          <button @click="$emit('cancel', r.id)" class="text-xs px-2 py-1 rounded-md border border-cream-300 hover:bg-cream-100">Cancel</button>
        </div>
      </div>
    </template>
  </DataTable>
</template>

<script setup>
import { onMounted, computed } from 'vue'
import { storeToRefs } from 'pinia'
import { LogOut, LogIn } from '@lucide/vue'
import AttendanceCalendar from '@/components/dashboard/AttendanceCalendar.vue'
import { useAttendanceStore } from '@/stores/attendance'

const store = useAttendanceStore()
const { monthCursor: month, monthData, signedInAt } = storeToRefs(store)
onMounted(() => store.refresh())

const days = computed(() => {
  const anchor = month.value
  const year = anchor.getFullYear()
  const m = anchor.getMonth()
  const first = new Date(year, m, 1)
  const last = new Date(year, m + 1, 0)
  const lead = (first.getDay() + 6) % 7 // Monday-first
  const cells = []
  for (let i = 0; i < lead; i++) {
    const d = new Date(year, m, i - lead + 1)
    cells.push({ date: d, key: `lead-${i}`, status: null, inMonth: false })
  }
  const lookup = monthData.value || {}
  for (let day = 1; day <= last.getDate(); day++) {
    const d = new Date(year, m, day)
    const iso = `${year}-${String(m + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    cells.push({ date: d, key: iso, status: lookup[iso] || null, inMonth: true })
  }
  const trail = (7 - (cells.length % 7)) % 7
  for (let i = 0; i < trail; i++) {
    const d = new Date(year, m + 1, i + 1)
    cells.push({ date: d, key: `trail-${i}`, status: null, inMonth: false })
  }
  return cells
})
</script>

<template>
  <section class="p-4 sm:p-6 lg:p-8">
    <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
      <div class="bg-white p-6 rounded-lg border border-cream-200 text-center">
        <div class="text-xs uppercase tracking-wider text-ink-500 mb-2">Today</div>
        <div class="text-3xl font-semibold mb-1">{{ new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }}</div>
        <div class="text-xs text-ink-500 mb-4">
          <span v-if="signedInAt">Signed in</span>
          <span v-else>Not signed in</span>
        </div>
        <button
          v-if="signedInAt"
          class="w-full py-3 rounded-md bg-rose-600 hover:bg-rose-700 text-white font-medium flex items-center justify-center gap-2"
          @click="store.signOut"
        >
          <LogOut class="w-4 h-4" />Sign out
        </button>
        <button
          v-else
          class="w-full py-3 rounded-md bg-brand-500 hover:bg-brand-600 text-white font-medium flex items-center justify-center gap-2"
          @click="store.signIn"
        >
          <LogIn class="w-4 h-4" />Sign in
        </button>
      </div>
      <div class="md:col-span-2">
        <AttendanceCalendar :month="month" :days="days" @prev="store.prev" @next="store.next" />
      </div>
    </div>
  </section>
</template>

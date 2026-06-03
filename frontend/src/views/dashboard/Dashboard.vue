<script setup>
import { onMounted } from 'vue'
import { storeToRefs } from 'pinia'
import { Users, CheckSquare, CalendarCheck, Plane } from '@lucide/vue'
import StatCard from '@/components/dashboard/StatCard.vue'
import HoursBarChart from '@/components/dashboard/HoursBarChart.vue'
import ActivityFeed from '@/components/dashboard/ActivityFeed.vue'
import { useDashboardStore } from '@/stores/dashboard'

const store = useDashboardStore()
const { stats, activity, hours, loading } = storeToRefs(store)

onMounted(() => store.fetch())
</script>

<template>
  <section class="p-4 sm:p-6 lg:p-8">
    <div v-if="stats" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      <StatCard label="Active Employees" :value="stats?.activeEmployees?.value" :delta="stats?.activeEmployees?.delta" :icon="Users" icon-class="text-brand-600" />
      <StatCard label="In-progress Tasks" :value="stats?.inProgressTasks?.value" :sub="stats?.inProgressTasks?.sub" :icon="CheckSquare" icon-class="text-amber-500" />
      <StatCard label="Today's Attendance" :value="stats?.todayAttendance?.value" :sub="stats?.todayAttendance?.sub" :icon="CalendarCheck" icon-class="text-emerald-500" />
      <StatCard label="Pending Leaves" :value="stats?.pendingLeaves?.value" :sub="stats?.pendingLeaves?.sub" :icon="Plane" icon-class="text-rose-500" />
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <div class="lg:col-span-2 bg-white p-5 rounded-lg border border-cream-200">
        <div class="flex items-center justify-between mb-4">
          <h3 class="font-semibold">Hours logged this week</h3>
          <span class="text-xs text-ink-500">vs. last week</span>
        </div>
        <HoursBarChart :data="hours.map(h => ({ day: h.day, percent: h.percent, tone: h.percent > 50 ? 'brand-500' : (h.percent > 0 ? 'brand-300' : 'cream-200') }))" />
      </div>
      <div class="bg-white p-5 rounded-lg border border-cream-200">
        <h3 class="font-semibold mb-4">Recent activity</h3>
        <ActivityFeed :items="activity" />
      </div>
    </div>
  </section>
</template>

<script setup>
import { ref } from 'vue'
import Sidebar from '@/components/dashboard/Sidebar.vue'
import Topbar from '@/components/dashboard/Topbar.vue'

const isSidebarOpen = ref(false)
function closeSidebar() { isSidebarOpen.value = false }
function toggleSidebar() { isSidebarOpen.value = !isSidebarOpen.value }
</script>

<template>
  <div class="flex h-screen overflow-hidden bg-cream-50 text-ink-900">
    <!-- Mobile backdrop -->
    <div
      v-if="isSidebarOpen"
      @click="closeSidebar"
      class="fixed inset-0 bg-ink-900/40 z-30 lg:hidden"
      aria-hidden="true"
    />

    <Sidebar :open="isSidebarOpen" @navigate="closeSidebar" />

    <main class="flex-1 overflow-y-auto">
      <Topbar @toggle-sidebar="toggleSidebar" />
      <router-view />
    </main>
  </div>
</template>

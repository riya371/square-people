<script setup>
defineProps({
  employee: { type: Object, required: true },
})
</script>

<template>
  <div class="bg-white rounded-lg border border-cream-200 p-5">
    <h3 class="font-semibold mb-3">Teams led</h3>
    <ul v-if="employee.teamsLed && employee.teamsLed.length" class="text-sm space-y-2">
      <li v-for="t in employee.teamsLed" :key="t.name" class="flex items-center justify-between">
        <span>{{ t.name }}</span>
        <span class="text-xs text-ink-500">{{ t.members }} members</span>
      </li>
    </ul>
    <p v-else class="text-sm text-ink-500">None.</p>
  </div>
</template>

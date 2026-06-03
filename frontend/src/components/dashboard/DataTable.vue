<script setup>
defineProps({
  rows: { type: Array, default: () => [] }, // generic row objects; consumer renders them
})
</script>

<template>
  <div class="bg-white rounded-lg border border-cream-200 overflow-hidden">
    <!-- Desktop / tablet: real <table>. Hidden below md by default; consumer can override via #mobileRow. -->
    <div class="hidden md:block">
      <table class="w-full text-sm">
        <thead class="bg-cream-100 text-left text-xs text-ink-500 uppercase tracking-wider">
          <tr><slot name="head" /></tr>
        </thead>
        <tbody class="divide-y divide-cream-200">
          <slot />
        </tbody>
        <tfoot v-if="$slots.foot" class="bg-cream-100">
          <slot name="foot" />
        </tfoot>
      </table>
    </div>

    <!-- Mobile fallback: stacked cards. Consumer provides #mobileRow per row. -->
    <div class="md:hidden divide-y divide-cream-200">
      <template v-if="$slots.mobileRow">
        <slot name="mobileRow" v-for="row in rows" :row="row" :key="row.id ?? row" />
      </template>
      <div v-else class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead class="bg-cream-100 text-left text-xs text-ink-500 uppercase tracking-wider">
            <tr><slot name="head" /></tr>
          </thead>
          <tbody class="divide-y divide-cream-200"><slot /></tbody>
        </table>
      </div>
    </div>

    <div v-if="$slots.footer" class="px-4 py-3 border-t border-cream-200">
      <slot name="footer" />
    </div>
  </div>
</template>

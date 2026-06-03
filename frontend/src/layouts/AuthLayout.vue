<script setup>
import { Cookie } from '@lucide/vue'
</script>

<template>
  <div class="min-h-screen flex">
    <!-- Brand panel (desktop only) -->
    <aside class="brand-panel relative hidden lg:flex w-2/5 flex-col justify-between p-12 text-white overflow-hidden">
      <div class="relative z-10">
        <div class="flex items-center gap-3 mb-12">
          <div class="w-10 h-10 rounded-xl bg-white/15 backdrop-blur flex items-center justify-center">
            <Cookie class="w-6 h-6 text-brand-300" />
          </div>
          <div class="leading-tight">
            <div class="font-bold text-lg">SquarePeople</div>
            <div class="text-xs uppercase tracking-wider text-white/70">by Square Feet</div>
          </div>
        </div>

        <slot name="brand-top" />
      </div>

      <slot name="brand-card" />

      <div class="relative z-10 text-xs text-white/60">
        © 2026 Square Feet LTD · squarefeetltd.com
      </div>
    </aside>

    <!-- Form panel -->
    <main class="flex-1 flex items-center justify-center p-6 lg:p-12">
      <div class="w-full max-w-md">
        <slot />
      </div>
    </main>
  </div>
</template>

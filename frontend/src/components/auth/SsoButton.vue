<template>
  <button
    type="button"
    class="w-full px-4 py-2.5 rounded-md border border-cream-300 bg-white hover:bg-cream-100 text-sm font-medium flex items-center justify-center gap-2 transition-colors"
  >
    <slot name="icon" />
    <slot />
  </button>
</template>

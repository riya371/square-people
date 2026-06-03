<script setup>
import { ref } from 'vue'
import { Eye, EyeOff } from '@lucide/vue'
import FormField from './FormField.vue'

const props = defineProps({
  modelValue: { type: String, default: '' },
  label: { type: String, default: 'Password' },
  placeholder: { type: String, default: '••••••••' },
  id: { type: String, default: 'password' },
  helper: { type: String, default: null },
})

defineEmits(['update:modelValue'])

const showing = ref(false)
</script>

<template>
  <FormField :label="label" :for="id" :helper="helper">
    <template v-if="$slots.action" #action>
      <slot name="action" />
    </template>
    <div class="relative">
      <input
        :id="id"
        :type="showing ? 'text' : 'password'"
        :placeholder="placeholder"
        :value="modelValue"
        @input="$emit('update:modelValue', $event.target.value)"
        class="w-full px-3 py-2.5 pr-10 rounded-md border border-cream-300 bg-white text-sm focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
      />
      <button
        type="button"
        @click="showing = !showing"
        :aria-label="showing ? 'Hide password' : 'Show password'"
        class="absolute right-3 top-2.5 text-ink-500/60 hover:text-ink-600"
      >
        <component :is="showing ? EyeOff : Eye" class="w-4 h-4" />
      </button>
    </div>
  </FormField>
</template>

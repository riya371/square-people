// src/composables/useTopbarSearch.js
import { ref } from 'vue'

// Module-level ref => singleton across all consumers.
const query = ref('')

export function useTopbarSearch() {
  return { query }
}

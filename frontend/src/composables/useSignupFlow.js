import { reactive } from 'vue'

const state = reactive({
  fullName: '',
  email: '',
  password: '',
  agreedToTerms: false,

  companyName: '',
  workspaceUrl: '',
  companySize: '11–50',
  industry: 'Technology',
  workdays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
})

export function useSignupFlow() {
  return state
}

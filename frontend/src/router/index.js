import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', redirect: '/app/dashboard' },

    { path: '/login',           name: 'login',           component: () => import('@/views/auth/Login.vue') },
    { path: '/signup',          name: 'signup',          component: () => import('@/views/auth/Signup.vue') },
    { path: '/signup/company',  name: 'signup-company',  component: () => import('@/views/auth/SignupCompany.vue') },
    { path: '/forgot-password', name: 'forgot-password', component: () => import('@/views/auth/ForgotPassword.vue') },
    { path: '/reset-password',  name: 'reset-password',  component: () => import('@/views/auth/ResetPassword.vue') },
    { path: '/employee-login',  name: 'employee-login',  redirect: { name: 'login', query: { mode: 'pin' } } },
    { path: '/accept-invite',   name: 'accept-invite',   component: () => import('@/views/auth/AcceptInvite.vue') },

    {
      path: '/app',
      component: () => import('@/layouts/DashboardLayout.vue'),
      meta: { requiresAuth: true },
      redirect: '/app/dashboard',
      children: [
        { path: 'dashboard',     name: 'dashboard',       meta: { title: 'Dashboard' },        component: () => import('@/views/dashboard/Dashboard.vue') },
        { path: 'employees',     name: 'employees',       meta: { title: 'Employees' },        component: () => import('@/views/dashboard/EmployeesList.vue') },
        { path: 'employees/:id', name: 'employee-detail', meta: { title: 'Employee detail' },  component: () => import('@/views/dashboard/EmployeeDetail.vue'), props: true },
        { path: 'teams',         name: 'teams',           meta: { title: 'Teams' },            component: () => import('@/views/dashboard/Teams.vue') },
        { path: 'departments',   name: 'departments',     meta: { title: 'Departments' },      component: () => import('@/views/dashboard/Departments.vue') },
        { path: 'projects',      name: 'projects',        meta: { title: 'Projects' },         component: () => import('@/views/dashboard/Projects.vue') },
        { path: 'tasks',         name: 'tasks',           meta: { title: 'Tasks — Kanban' },   component: () => import('@/views/dashboard/TasksKanban.vue') },
        { path: 'time',          name: 'time',            meta: { title: 'Time tracking' },    component: () => import('@/views/dashboard/TimeTracking.vue') },
        { path: 'attendance',    name: 'attendance',      meta: { title: 'Attendance' },       component: () => import('@/views/dashboard/Attendance.vue') },
        { path: 'leaves',        name: 'leaves',          meta: { title: 'Leaves' },           component: () => import('@/views/dashboard/Leaves.vue') },
      ],
    },

    { path: '/:pathMatch(.*)*', redirect: '/login' },
  ],
})

router.beforeEach(async (to) => {
  const auth = useAuthStore()
  if (auth.user === null && auth.loading === false && !auth.error) {
    // App-boot resolve: try once to populate /me before routing further.
    await auth.fetchMe().catch(() => null)
  }
  if (to.matched.some((r) => r.meta.requiresAuth) && !auth.signedIn) {
    return { name: 'login', query: { from: to.fullPath } }
  }
  // If a signed-in user lands on /login or /signup, redirect into the app.
  if (auth.signedIn && ['login', 'signup', 'signup-company'].includes(to.name)) {
    return { name: 'dashboard' }
  }
})

export default router

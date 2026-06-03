// src/components/dashboard/nav.js
import {
  LayoutDashboard, Users, UsersRound, Building2,
  FolderKanban, CheckSquare, Timer, CalendarCheck, Plane,
} from '@lucide/vue'

export const NAV_SECTIONS = [
  {
    items: [
      { to: { name: 'dashboard' }, icon: LayoutDashboard, label: 'Dashboard' },
    ],
  },
  {
    label: 'Organization',
    items: [
      { to: { name: 'employees' },   icon: Users,      label: 'Employees' },
      { to: { name: 'teams' },       icon: UsersRound, label: 'Teams' },
      { to: { name: 'departments' }, icon: Building2,  label: 'Departments' },
    ],
  },
  {
    label: 'Work',
    items: [
      { to: { name: 'projects' }, icon: FolderKanban, label: 'Projects' },
      { to: { name: 'tasks' },    icon: CheckSquare,  label: 'Tasks (Kanban)' },
    ],
  },
  {
    label: 'Time & HR',
    items: [
      { to: { name: 'time' },       icon: Timer,         label: 'Time tracking' },
      { to: { name: 'attendance' }, icon: CalendarCheck, label: 'Attendance' },
      { to: { name: 'leaves' },     icon: Plane,         label: 'Leaves' },
    ],
  },
]

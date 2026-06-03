// Central role/capability map for the UI. Mirrors the API's requireRole gates
// (hierarchy: member < manager < admin < owner). The API stays the source of
// truth — this only decides what to *show*; the server still enforces writes.

export const ROLE_RANK = { member: 0, manager: 1, admin: 2, owner: 3 }

// Minimum role required for each UI capability.
export const CAPABILITIES = {
  'employees.view': 'manager',     // see the employee directory / detail
  'employees.manage': 'admin',     // create / edit / delete employees, assign roles
  'departments.view': 'admin',
  'departments.manage': 'admin',
  'teams.manage': 'admin',         // create / edit / delete teams, manage members
  'roles.manage': 'admin',
  'projects.manage': 'manager',    // create / edit projects, change status
  'projects.delete': 'admin',      // delete projects, link teams
  'leaves.approve': 'manager',     // approve / reject leave requests
  'audit.view': 'admin',
  'company.manage': 'admin',
}

export function rankOf(role) {
  return ROLE_RANK[role] ?? -1
}

export function roleAtLeast(role, minRole) {
  return rankOf(role) >= rankOf(minRole)
}

export function hasCap(role, cap) {
  const min = CAPABILITIES[cap]
  if (!min) return true // unknown capability → not restricted
  return roleAtLeast(role, min)
}

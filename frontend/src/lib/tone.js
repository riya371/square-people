const ROLE_TONES = ['brand', 'accent', 'amber', 'rose', 'ink']

function hashStr(s) {
  let h = 0
  for (let i = 0; i < (s || '').length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
  return Math.abs(h)
}

export function roleTone(roleName) {
  if (!roleName) return 'brand'
  const lower = roleName.toLowerCase()
  if (lower.includes('tech lead') || lower.includes('lead')) return 'accent'
  if (lower.includes('manager') || lower.includes('admin')) return 'amber'
  if (lower.includes('designer')) return 'rose'
  if (lower.includes('dev') || lower.includes('engineer')) return 'brand'
  return ROLE_TONES[hashStr(roleName) % ROLE_TONES.length]
}

export function statusTone(status) {
  switch (status) {
    case 'active': return 'emerald'
    case 'inactive': return 'ink'
    case 'terminated': return 'rose'
    case 'pending': return 'amber'
    case 'approved': return 'emerald'
    case 'rejected': return 'rose'
    default: return 'ink'
  }
}

const GRADIENTS = [
  'brand-accent', 'amber-rose', 'brand-300-600', 'ink-brand', 'accent-brand',
]

function hashName(name) {
  let h = 0
  for (let i = 0; i < (name || '').length; i++) h = (h * 31 + name.charCodeAt(i)) | 0
  return Math.abs(h)
}

export function computeInitials(name) {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export function computeGradient(name) {
  return GRADIENTS[hashName(name) % GRADIENTS.length]
}

export function computeAvatar(name) {
  return { initials: computeInitials(name), gradient: computeGradient(name) }
}

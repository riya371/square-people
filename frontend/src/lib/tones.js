// src/lib/tones.js
// Centralised tone -> tailwind class maps. Components import the relevant
// map and look up classes by a `tone` prop fed from fixtures or props.

export const STATUS_TONES = {
  active:     { bg: 'bg-emerald-50',  text: 'text-emerald-700', dot: 'bg-emerald-500' },
  inactive:   { bg: 'bg-cream-200',   text: 'text-ink-600',     dot: 'bg-ink-500/40' },
  terminated: { bg: 'bg-rose-50',     text: 'text-rose-700',    dot: 'bg-rose-500' },
  pending:    { bg: 'bg-amber-50',    text: 'text-amber-700',   dot: 'bg-amber-500' },
  approved:   { bg: 'bg-emerald-50',  text: 'text-emerald-700', dot: 'bg-emerald-500' },
  rejected:   { bg: 'bg-rose-50',     text: 'text-rose-700',    dot: 'bg-rose-500' },
  'in-progress': { bg: 'bg-amber-50', text: 'text-amber-700',   dot: 'bg-amber-500' },
  'on-track': { bg: 'bg-emerald-50',  text: 'text-emerald-700', dot: 'bg-emerald-500' },
  'at-risk':  { bg: 'bg-rose-50',     text: 'text-rose-700',    dot: 'bg-rose-500' },
}

export const ROLE_TONES = {
  brand:  { bg: 'bg-brand-100',  text: 'text-brand-800' },
  accent: { bg: 'bg-accent-50',  text: 'text-accent-700' },
  amber:  { bg: 'bg-amber-50',   text: 'text-amber-700' },
  rose:   { bg: 'bg-rose-50',    text: 'text-rose-700' },
  cream:  { bg: 'bg-cream-200',  text: 'text-ink-600' },
  emerald:{ bg: 'bg-emerald-50', text: 'text-emerald-700' },
  ink:    { bg: 'bg-ink-100',    text: 'text-ink-700' },
}

export const PRIORITY_TONES = {
  high:   { bg: 'bg-rose-50',   text: 'text-rose-700' },
  medium: { bg: 'bg-amber-50',  text: 'text-amber-700' },
  low:    { bg: 'bg-cream-200', text: 'text-ink-600' },
}

export const AVATAR_GRADIENTS = {
  'brand-accent':  'from-brand-500 to-accent-500',
  'amber-rose':    'from-amber-400 to-rose-500',
  'brand-300-600': 'from-brand-300 to-brand-600',
  'ink-brand':     'from-ink-500 to-brand-900',
  'accent-brand':  'from-accent-500 to-brand-700',
}

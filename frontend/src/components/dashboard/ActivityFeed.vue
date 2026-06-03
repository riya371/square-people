<script setup>
import {
  Check, Plane, FolderPlus, UserPlus, Activity,
  ClipboardPlus, ArrowRightLeft, ClipboardPen,
  Users, UserCheck, Timer, UserRoundPlus, LogIn,
} from '@lucide/vue'
import { relative } from '@/lib/dates'

defineProps({
  items: { type: Array, required: true },
})

const KIND = {
  'task-complete':  { icon: Check,      bg: 'bg-emerald-100', fg: 'text-emerald-700' },
  'leave-request':  { icon: Plane,      bg: 'bg-brand-100',   fg: 'text-brand-800' },
  'leave-approve':  { icon: Check,      bg: 'bg-emerald-100', fg: 'text-emerald-700' },
  'leave-reject':   { icon: Plane,      bg: 'bg-rose-100',    fg: 'text-rose-700' },
  'project-create': { icon: FolderPlus, bg: 'bg-amber-100',   fg: 'text-amber-700' },
  'team-join':      { icon: UserPlus,   bg: 'bg-rose-100',    fg: 'text-rose-700' },
  'task-create':    { icon: ClipboardPlus,   bg: 'bg-brand-100',   fg: 'text-brand-800' },
  'task-move':      { icon: ArrowRightLeft,  bg: 'bg-amber-100',   fg: 'text-amber-700' },
  'task-update':    { icon: ClipboardPen,    bg: 'bg-cream-100',   fg: 'text-ink-600' },
  'team-create':    { icon: Users,           bg: 'bg-brand-100',   fg: 'text-brand-800' },
  'team-members':   { icon: UserCheck,       bg: 'bg-emerald-100', fg: 'text-emerald-700' },
  'timer-start':    { icon: Timer,           bg: 'bg-accent-50',   fg: 'text-accent-700' },
  'user-signup':    { icon: UserRoundPlus,   bg: 'bg-brand-100',   fg: 'text-brand-800' },
  'user-login':     { icon: LogIn,           bg: 'bg-cream-100',   fg: 'text-ink-600' },
}
const FALLBACK = { icon: Activity, bg: 'bg-cream-100', fg: 'text-ink-600' }
function kind(k) { return KIND[k] || FALLBACK }
function actorName(a) { return typeof a === 'string' ? a : a?.name || '' }
</script>

<template>
  <ul class="space-y-3 text-sm">
    <li v-for="item in items" :key="item.id" class="flex gap-3">
      <div :class="['w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0', kind(item.kind).bg, kind(item.kind).fg]">
        <component :is="kind(item.kind).icon" class="w-4 h-4" />
      </div>
      <div>
        <span v-if="item.actor" class="font-medium">{{ actorName(item.actor) }} </span>{{ item.text }}
        <div class="text-xs text-ink-500/60">{{ relative(item.timestamp) }}</div>
      </div>
    </li>
  </ul>
</template>

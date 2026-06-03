const SHORT_MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

export function shortDate(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  return `${SHORT_MONTHS[d.getMonth()]} ${d.getDate()}`
}

export function shortMonthYear(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  return `${SHORT_MONTHS[d.getMonth()]} ${d.getFullYear()}`
}

export function relative(iso) {
  if (!iso) return ''
  const ms = Date.now() - new Date(iso).getTime()
  const min = Math.floor(ms / 60000)
  if (min < 1) return 'just now'
  if (min < 60) return `${min}m ago`
  const h = Math.floor(min / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  if (d < 7) return `${d}d ago`
  return shortDate(iso)
}

export function clockTime(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export function fmtTimer(sec) {
  const hh = String(Math.floor(sec / 3600)).padStart(2, '0')
  const mm = String(Math.floor((sec % 3600) / 60)).padStart(2, '0')
  const ss = String(sec % 60).padStart(2, '0')
  return `${hh}:${mm}:${ss}`
}

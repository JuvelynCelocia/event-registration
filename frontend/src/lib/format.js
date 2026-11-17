export function parseLocalDate(value) {
  if (!value) return null
  const [year, month, day] = String(value).split('-').map(Number)
  if (!year || !month || !day) return null
  const date = new Date(year, month - 1, day)
  return Number.isNaN(date.getTime()) ? null : date
}

export function formatDate(value) {
  const date = parseLocalDate(value)
  if (!date) return ''
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export function formatTime(value) {
  if (!value) return ''
  const [hourString, minuteString] = String(value).split(':')
  const hour = Number(hourString)
  const minute = Number(minuteString)
  if (Number.isNaN(hour) || Number.isNaN(minute)) return ''
  const suffix = hour >= 12 ? 'PM' : 'AM'
  const displayHour = hour % 12 || 12
  return `${displayHour}:${String(minute).padStart(2, '0')} ${suffix}`
}

export function formatTimeRange(start, end) {
  const from = formatTime(start)
  const to = formatTime(end)
  if (!from || !to) return from || to
  return `${from} – ${to}`
}

export function isPastDate(value) {
  const date = parseLocalDate(value)
  if (!date) return false
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return date < today
}

export function initials(name = '') {
  const letters = String(name)
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('')
  return letters || '?'
}

export function toDateInputValue(value) {
  return value ? String(value).slice(0, 10) : ''
}

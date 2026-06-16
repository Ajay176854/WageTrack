/**
 * Normalize any date string into YYYY-MM-DD format
 * Preserves timezone as IST (Asia/Kolkata) to match factory location
 */
export function normalizeDate(dateStr) {
  if (!dateStr) return ''

  // Direct YYYY-MM-DD or YYYY/MM/DD extraction (no timezone shift)
  if (typeof dateStr === 'string' && !dateStr.includes('T') && !dateStr.includes('Z')) {
    const match = dateStr.match(/^(\d{4})[-/](\d{2})[-/](\d{2})/)
    if (match) return `${match[1]}-${match[2]}-${match[3]}`
  }

  const d = new Date(dateStr)
  if (isNaN(d.getTime())) {
    // Handle DD/MM/YYYY backup parsing
    if (typeof dateStr === 'string') {
      const matchDMY = dateStr.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/)
      if (matchDMY) {
        const day = matchDMY[1].padStart(2, '0')
        const month = matchDMY[2].padStart(2, '0')
        return `${matchDMY[3]}-${month}-${day}`
      }
    }
    return String(dateStr).split('T')[0]
  }

  // Force IST timezone
  try {
    const options = { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }
    return new Intl.DateTimeFormat('en-CA', options).format(d)
  } catch {
    const year = d.getFullYear()
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }
}

/**
 * Get today's date as YYYY-MM-DD in IST
 */
export function todayStr() {
  const d = new Date()
  try {
    const options = { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }
    return new Intl.DateTimeFormat('en-CA', options).format(d)
  } catch {
    return d.getFullYear() + '-' +
      String(d.getMonth() + 1).padStart(2, '0') + '-' +
      String(d.getDate()).padStart(2, '0')
  }
}

/**
 * Get the current month string (YYYY-MM)
 */
export function currentMonthStr() {
  const d = new Date()
  return d.toISOString().substr(0, 7)
}

/**
 * Get number of days in the month for a given date string
 */
export function getMonthDays(dateStr) {
  const d = new Date(dateStr)
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
}

/**
 * Format a date string for display
 */
export function formatDate(dateStr, options = {}) {
  if (!dateStr) return ''
  const d = new Date(dateStr + 'T00:00:00')
  const defaults = { day: '2-digit', month: 'short', year: '2-digit' }
  return d.toLocaleDateString('en-IN', { ...defaults, ...options })
}

/**
 * Format a date for display with weekday
 */
export function formatDateWithDay(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })
}

/**
 * Get start/end dates for preset periods
 */
export function getDateRange(period) {
  const today = todayStr()

  switch (period) {
    case 'today':
      return { from: today, to: today }

    case 'week': {
      const d = new Date()
      const dayOfWeek = d.getDay()
      const diff = d.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1)
      const monday = new Date(d.setDate(diff))
      return { from: normalizeDate(monday.toISOString()), to: today }
    }

    case 'month': {
      const d = new Date()
      const firstDay = new Date(d.getFullYear(), d.getMonth(), 1)
      return { from: normalizeDate(firstDay.toISOString()), to: today }
    }

    default:
      return { from: today, to: today }
  }
}

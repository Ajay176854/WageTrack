import { CATEGORY_UNIT_MAP, STATUS_COLORS } from '../config/constants'

/**
 * Generate a short unique ID
 */
export function uid() {
  return Math.random().toString(36).substr(2, 9)
}

/**
 * Check if an attendance status is a half-day
 */
export function isHalfDay(status) {
  return status === 'forenoon' || status === 'afternoon'
}

/**
 * Check if an attendance status counts as working
 */
export function isWorking(status) {
  return status === 'present' || status === 'forenoon' || status === 'afternoon'
}

/**
 * Get the CSS color for an attendance status
 */
export function statusColor(status) {
  return STATUS_COLORS[status] || 'var(--border)'
}

/**
 * Map a category/type to a unit key
 */
export function getProdKey(input) {
  if (['unit1', 'unit2', 'unit3', 'unit4', 'maintenance'].includes(input)) return input
  return CATEGORY_UNIT_MAP[input] || 'unit1'
}

/**
 * Format a currency value with ₹ symbol
 */
export function formatCurrency(amount) {
  return `₹${(amount || 0).toLocaleString('en-IN')}`
}

/**
 * Safely parse a numeric value
 */
export function safeNum(val) {
  const n = parseFloat(val)
  return isNaN(n) ? 0 : n
}

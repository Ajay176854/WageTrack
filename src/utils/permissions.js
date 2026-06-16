import { getProdKey } from './helpers'

/**
 * Check if user has access to a production unit
 */
export function hasProductionAccess(user, prodType) {
  if (!user) return false
  if (user.role === 'admin') return true
  const prodKey = getProdKey(prodType)
  return user.access && user.access[prodKey] && user.access[prodKey].length > 0
}

/**
 * Check if user has a specific action permission on a unit
 */
export function hasActionPermission(user, prodType, action) {
  if (!user) return false
  if (user.role === 'admin') return true
  const prodKey = getProdKey(prodType)
  return user.access && user.access[prodKey] && user.access[prodKey].includes(action)
}

/**
 * Check if user has full access (attendance + work + payment) to a unit
 */
export function hasFullUnitAccess(user, unit) {
  if (!user) return false
  if (user.role === 'admin') return true
  const prodKey = getProdKey(unit)
  return (
    user.access &&
    user.access[prodKey] &&
    user.access[prodKey].includes('attendance') &&
    user.access[prodKey].includes('work') &&
    user.access[prodKey].includes('payment')
  )
}

/**
 * Check if user has maintenance permission
 */
export function hasMaintenancePermission(user) {
  if (!user) return false
  if (user.role === 'admin') return true
  return user.access && user.access.maintenance && user.access.maintenance.length > 0
}

/**
 * Get all production units accessible by the user
 */
export function getAccessibleProductions(user) {
  if (!user) return []
  if (user.role === 'admin') return ['unit1', 'unit2', 'unit3', 'unit4']
  const accessible = []
  if (user.access) {
    Object.keys(user.access).forEach((prodKey) => {
      if (
        user.access[prodKey].length > 0 &&
        ['unit1', 'unit2', 'unit3', 'unit4'].includes(prodKey)
      ) {
        accessible.push(prodKey)
      }
    })
  }
  return accessible
}

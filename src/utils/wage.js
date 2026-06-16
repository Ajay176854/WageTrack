import { isHalfDay, isWorking, safeNum } from './helpers'
import { getMonthDays } from './date'

/**
 * Calculate base pay for a worker on a given day based on category and attendance
 */
export function calcDailyBasePay(worker, attendanceRecord, dayEntries = []) {
  const status = attendanceRecord?.status || ''
  const present = isWorking(status)
  const halfDay = isHalfDay(status)
  const multiplier = halfDay ? 0.5 : 1
  const category = worker.category || 'piece_work'

  // Piece work / packing — sum up entry wages
  const pieceWage = dayEntries.reduce((sum, e) => sum + safeNum(e.wage), 0)

  if (category === 'monthly_salary' && present) {
    const date = attendanceRecord?.date || new Date().toISOString().split('T')[0]
    const monthDays = getMonthDays(date)
    return Math.round((safeNum(worker.salary) / monthDays) * multiplier)
  }

  if (category === 'daily_wages' && present) {
    return Math.round(safeNum(worker.daily_wage) * multiplier)
  }

  if ((category === 'bundle_packing' || category === 'cover_packing') && halfDay) {
    return Math.round(pieceWage * 0.5)
  }

  return pieceWage
}

/**
 * Calculate OT amount
 */
export function calcOTAmount(otHours, otRate) {
  return Math.round(safeNum(otHours) * safeNum(otRate))
}

/**
 * Calculate net pay for a day (basePay + OT - advance)
 */
export function calcNetDailyPay(basePay, otAmount, advance) {
  return safeNum(basePay) + safeNum(otAmount) - safeNum(advance)
}

/**
 * Calculate wage for a piece-work entry
 */
export function calcPieceWage(outputKg, pieceRate) {
  return Math.round(safeNum(outputKg) * safeNum(pieceRate))
}

/**
 * Calculate wage for a packing entry
 */
export function calcPackingWage(pieces, packRate, ratePerPiece) {
  if (safeNum(ratePerPiece) > 0) return safeNum(ratePerPiece)
  return Math.round(safeNum(pieces) * safeNum(packRate))
}

/**
 * Calculate paid leave bonus for monthly salary workers
 */
export function calcPaidLeaveBonus(worker, attendanceRecords, fromDate) {
  const monthDays = getMonthDays(fromDate)
  const perDay = Math.round(safeNum(worker.salary) / monthDays)

  const absentDays = attendanceRecords.filter(
    (a) => a.worker_id === worker.id && a.status === 'absent'
  ).length

  const halfDayAbsent =
    attendanceRecords.filter(
      (a) =>
        a.worker_id === worker.id &&
        (a.status === 'forenoon' || a.status === 'afternoon')
    ).length * 0.5

  const totalAbsent = absentDays + halfDayAbsent
  const unused = Math.max(0, safeNum(worker.paid_leaves) - totalAbsent)

  return { bonus: Math.round(unused * perDay), unused, perDay, monthDays }
}

/**
 * Calculate monthly totals for a worker
 */
export function calcMonthlyTotals(worker, monthEntries, monthAttendance) {
  const monthDays = getMonthDays(
    monthAttendance[0]?.date || new Date().toISOString().split('T')[0]
  )

  const wageEarned = monthEntries.reduce((sum, e) => sum + safeNum(e.wage), 0)
  const otTotal = monthAttendance.reduce((sum, a) => sum + safeNum(a.ot_amount), 0)
  const advanceTotal = monthAttendance.reduce((sum, a) => sum + safeNum(a.advance), 0)
  const daysPresent = monthAttendance
    .filter((a) => isWorking(a.status))
    .reduce((acc, a) => acc + (isHalfDay(a.status) ? 0.5 : 1), 0)

  let basePay = wageEarned
  if (worker.category === 'monthly_salary') {
    basePay = Math.round((safeNum(worker.salary) / monthDays) * daysPresent)
  }

  const grandTotal = basePay + otTotal
  const netPay = grandTotal - advanceTotal

  return { basePay, wageEarned, otTotal, advanceTotal, daysPresent, grandTotal, netPay, monthDays }
}

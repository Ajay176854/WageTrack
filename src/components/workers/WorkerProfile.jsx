import { useState, useEffect } from 'react'
import Modal from '../common/Modal'
import StatusBadge from '../common/StatusBadge'
import { attendanceService } from '../../services/attendance.service'
import { entriesService } from '../../services/entries.service'
import { currentMonthStr, formatDateWithDay } from '../../utils/date'
import { calcMonthlyTotals } from '../../utils/wage'
import { CATEGORY_LABELS, UNIT_LABELS } from '../../config/constants'
import { formatCurrency } from '../../utils/helpers'
import styles from '../../styles/Modal.module.css'

export default function WorkerProfile({ isOpen, onClose, worker }) {
  const [monthEntries, setMonthEntries] = useState([])
  const [monthAttendance, setMonthAttendance] = useState([])
  const [loading, setLoading] = useState(true)
  const [totals, setTotals] = useState(null)

  useEffect(() => {
    if (isOpen && worker) {
      loadWorkerData()
    }
  }, [isOpen, worker])

  const loadWorkerData = async () => {
    setLoading(true)
    try {
      const monthStr = currentMonthStr()
      const startOfMonth = `${monthStr}-01`
      const endOfMonth = `${monthStr}-31`

      const [entries, attendance] = await Promise.all([
        entriesService.getAll({
          workerId: worker.id,
          dateFrom: startOfMonth,
          dateTo: endOfMonth
        }),
        attendanceService.getAll({
          workerId: worker.id,
          dateFrom: startOfMonth,
          dateTo: endOfMonth
        })
      ])

      setMonthEntries(entries)
      setMonthAttendance(attendance)
      setTotals(calcMonthlyTotals(worker, entries, attendance))
    } catch (err) {
      console.error('Failed to load worker profile data', err)
    } finally {
      setLoading(false)
    }
  }

  if (!worker) return null

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Worker Profile">
      <div className={styles.profileContainer}>
        {/* Header Profile Section */}
        <div className={styles.profileHeader}>
          <div className={styles.profileAvatar}>{worker.emoji || '👷'}</div>
          <div className={styles.profileInfo}>
            <h2>{worker.name}</h2>
            <p>ID: {worker.emp_id || 'N/A'} • {UNIT_LABELS[worker.unit]}</p>
            <span className={styles.badge}>{CATEGORY_LABELS[worker.category] || worker.category}</span>
          </div>
        </div>

        {loading ? (
          <div className={styles.loadingState}>Loading data...</div>
        ) : (
          <>
            {/* Monthly Summary Cards */}
            <div className={styles.statsGrid}>
              <div className={styles.statCard}>
                <div className={styles.statLabel}>Days Present</div>
                <div className={styles.statValue}>{totals?.daysPresent || 0}</div>
                <div className={styles.statSub}>out of {totals?.monthDays || 30}</div>
              </div>
              
              <div className={styles.statCard}>
                <div className={styles.statLabel}>Total Wage</div>
                <div className={styles.statValue}>{formatCurrency(totals?.wageEarned || 0)}</div>
                <div className={styles.statSub}>Base earnings</div>
              </div>
              
              <div className={styles.statCard}>
                <div className={styles.statLabel}>Advances</div>
                <div className={styles.statValue}>{formatCurrency(totals?.advanceTotal || 0)}</div>
                <div className={styles.statSub}>Taken this month</div>
              </div>
              
              <div className={styles.statCard} style={{ backgroundColor: 'rgba(74, 222, 128, 0.1)', borderColor: 'rgba(74, 222, 128, 0.3)' }}>
                <div className={styles.statLabel} style={{ color: 'var(--accent2)' }}>Est. Net Pay</div>
                <div className={styles.statValue} style={{ color: 'var(--accent2)' }}>{formatCurrency(totals?.netPay || 0)}</div>
                <div className={styles.statSub}>End of month payout</div>
              </div>
            </div>

            {/* Recent Activity */}
            <div className={styles.sectionHeader}>
              <h3>Recent Activity</h3>
            </div>
            
            <div className={styles.activityList}>
              {monthAttendance.slice(0, 5).map(record => {
                const entry = monthEntries.find(e => e.date === record.date)
                return (
                  <div key={record.id} className={styles.activityItem}>
                    <div className={styles.activityDate}>
                      {formatDateWithDay(record.date)}
                    </div>
                    <div className={styles.activityDetails}>
                      <StatusBadge status={record.status} />
                      {entry && <span className={styles.activityWage}>+{formatCurrency(entry.wage)}</span>}
                      {record.advance > 0 && <span className={styles.activityAdvance}>-{formatCurrency(record.advance)} adv</span>}
                    </div>
                  </div>
                )
              })}
              {monthAttendance.length === 0 && (
                <div className={styles.emptyActivity}>No activity recorded this month.</div>
              )}
            </div>
          </>
        )}
      </div>
    </Modal>
  )
}

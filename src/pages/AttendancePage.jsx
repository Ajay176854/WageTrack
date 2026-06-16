import { useState, useMemo } from 'react'
import { useAppContext } from '../contexts/AppContext'
import { attendanceService } from '../services/attendance.service'
import UnitTabs from '../components/common/UnitTabs'
import SearchInput from '../components/common/SearchInput'
import StatusBadge from '../components/common/StatusBadge'
import { todayStr, formatDateWithDay } from '../utils/date'
import { UNIT_COLORS } from '../config/constants'
import { formatCurrency } from '../utils/helpers'
import styles from '../styles/Attendance.module.css'

export default function AttendancePage() {
  const { workers, attendance, currentUnit, setCurrentUnit, showToast } = useAppContext()
  
  const [date, setDate] = useState(todayStr())
  const [searchQuery, setSearchQuery] = useState('')
  const [loadingIds, setLoadingIds] = useState(new Set())

  // Get attendance for selected date
  const dateAttendance = useMemo(() => {
    return attendance.filter(a => a.date === date)
  }, [attendance, date])

  // Filter workers
  const filteredWorkers = useMemo(() => {
    return workers.filter(w => {
      if (currentUnit !== 'all' && w.unit !== currentUnit) return false
      if (searchQuery) {
        return w.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
               (w.emp_id && w.emp_id.toLowerCase().includes(searchQuery.toLowerCase()))
      }
      return true
    })
  }, [workers, currentUnit, searchQuery])

  // Mark all present
  const handleMarkAllPresent = async () => {
    if (filteredWorkers.length === 0) return
    
    // Find workers who don't have attendance yet
    const toUpdate = filteredWorkers.filter(w => !dateAttendance.find(a => a.worker_id === w.id))
    
    if (toUpdate.length === 0) {
      showToast('All workers already have attendance marked')
      return
    }

    const records = toUpdate.map(w => ({
      worker_id: w.id,
      unit: w.unit,
      date,
      status: 'present'
    }))

    try {
      await attendanceService.bulkUpsert(records)
      showToast(`Marked ${records.length} present`)
    } catch (err) {
      showToast('Failed to mark attendance')
    }
  }

  // Update single field
  const handleUpdate = async (workerId, unit, field, value) => {
    setLoadingIds(prev => new Set(prev).add(workerId))
    try {
      await attendanceService.updateField(workerId, date, field, value, unit)
      // Note: real-time subscription will update the global state
    } catch (err) {
      showToast('Failed to update')
    } finally {
      setLoadingIds(prev => {
        const next = new Set(prev)
        next.delete(workerId)
        return next
      })
    }
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2>Attendance</h2>
        <input 
          type="date" 
          value={date} 
          onChange={(e) => setDate(e.target.value)} 
          className={styles.datePicker}
        />
      </div>

      <UnitTabs activeUnit={currentUnit} onChange={setCurrentUnit} />

      <div className={styles.controls}>
        <div className={styles.searchWrap}>
          <SearchInput value={searchQuery} onChange={setSearchQuery} placeholder="Search workers..." />
        </div>
        <button 
          className="btn btn-secondary" 
          onClick={handleMarkAllPresent}
          disabled={filteredWorkers.length === 0}
        >
          Mark All Present
        </button>
      </div>

      <div className={styles.statsBar}>
        <div className={styles.statGroup}>
          <span className={styles.statLabel}>Total:</span>
          <span className={styles.statValue}>{filteredWorkers.length}</span>
        </div>
        <div className={styles.statGroup}>
          <span className={styles.statLabel}>Marked:</span>
          <span className={styles.statValue}>
            {filteredWorkers.filter(w => dateAttendance.some(a => a.worker_id === w.id)).length}
          </span>
        </div>
      </div>

      <div className={styles.attendanceList}>
        {filteredWorkers.map(worker => {
          const record = dateAttendance.find(a => a.worker_id === worker.id)
          const isLoading = loadingIds.has(worker.id)
          const status = record?.status || ''
          const unitColor = UNIT_COLORS[worker.unit] || UNIT_COLORS.unit1

          return (
            <div key={worker.id} className={`${styles.attCard} ${isLoading ? styles.loading : ''}`}>
              <div className={styles.attHeader}>
                <div className={styles.workerInfo}>
                  <div className={styles.avatar}>{worker.emoji}</div>
                  <div>
                    <div className={styles.name}>{worker.name}</div>
                    <div className={styles.meta}>
                      <span style={{ color: unitColor.color }}>{worker.unit.replace('unit', 'U')}</span>
                      <span> • {worker.category === 'monthly_salary' ? 'Salary' : worker.category === 'daily_wages' ? 'Daily' : 'Piece'}</span>
                    </div>
                  </div>
                </div>
                {status && <StatusBadge status={status} />}
              </div>

              <div className={styles.statusControls}>
                <button 
                  className={`${styles.statusBtn} ${status === 'present' ? styles.activePresent : ''}`}
                  onClick={() => handleUpdate(worker.id, worker.unit, 'status', 'present')}
                >
                  Present
                </button>
                <button 
                  className={`${styles.statusBtn} ${status === 'absent' ? styles.activeAbsent : ''}`}
                  onClick={() => handleUpdate(worker.id, worker.unit, 'status', 'absent')}
                >
                  Absent
                </button>
                <button 
                  className={`${styles.statusBtn} ${status === 'forenoon' ? styles.activeHalf : ''}`}
                  onClick={() => handleUpdate(worker.id, worker.unit, 'status', 'forenoon')}
                >
                  FN
                </button>
                <button 
                  className={`${styles.statusBtn} ${status === 'afternoon' ? styles.activeHalf : ''}`}
                  onClick={() => handleUpdate(worker.id, worker.unit, 'status', 'afternoon')}
                >
                  AN
                </button>
              </div>

              {/* OT and Advance visible if marked */}
              {status && (
                <div className={styles.extraControls}>
                  <div className={styles.inputGroup}>
                    <label>OT Hrs</label>
                    <input 
                      type="number" 
                      min="0" step="0.5"
                      value={record.ot_hours || ''}
                      onChange={(e) => handleUpdate(worker.id, worker.unit, 'ot_hours', e.target.value)}
                      placeholder="0"
                    />
                  </div>
                  <div className={styles.inputGroup}>
                    <label>Advance</label>
                    <input 
                      type="number" 
                      min="0" step="1"
                      value={record.advance || ''}
                      onChange={(e) => handleUpdate(worker.id, worker.unit, 'advance', e.target.value)}
                      placeholder="₹0"
                    />
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

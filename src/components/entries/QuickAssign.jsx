import { useState, useMemo } from 'react'
import Modal from '../common/Modal'
import { entriesService } from '../../services/entries.service'
import { attendanceService } from '../../services/attendance.service'
import { useAppContext } from '../../contexts/AppContext'
import { calcPieceWage } from '../../utils/wage'
import { UNITS, UNIT_LABELS } from '../../config/constants'
import { todayStr } from '../../utils/date'
import styles from '../../styles/Modal.module.css'

export default function QuickAssign({ isOpen, onClose, defaultUnit }) {
  const { workers, showToast, fetchAllData } = useAppContext()
  
  const [loading, setLoading] = useState(false)
  const [unit, setUnit] = useState(defaultUnit || 'unit1')
  const [date, setDate] = useState(todayStr())
  const [globalRate, setGlobalRate] = useState('')
  
  const [workerOutputs, setWorkerOutputs] = useState({})

  // Only piece workers for the selected unit
  const eligibleWorkers = useMemo(() => {
    return workers.filter(w => w.unit === unit && w.category === 'piece_work')
  }, [workers, unit])

  const handleOutputChange = (workerId, value) => {
    setWorkerOutputs(prev => ({
      ...prev,
      [workerId]: value
    }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (!globalRate) {
      alert('Please enter a global rate')
      return
    }

    setLoading(true)

    try {
      const entriesToCreate = []
      const attendanceToCreate = []

      for (const worker of eligibleWorkers) {
        const output = workerOutputs[worker.id]
        if (output && Number(output) > 0) {
          const outNum = Number(output)
          const rateNum = Number(globalRate)
          
          entriesToCreate.push({
            worker_id: worker.id,
            unit,
            date,
            category: 'piece_work',
            output: outNum,
            rate: rateNum,
            wage: calcPieceWage(outNum, rateNum)
          })

          attendanceToCreate.push({
            worker_id: worker.id,
            unit,
            date,
            status: 'present'
          })
        }
      }

      if (entriesToCreate.length === 0) {
        alert('No outputs entered')
        setLoading(false)
        return
      }

      // Bulk save
      await entriesService.bulkUpsert(entriesToCreate)
      await attendanceService.bulkUpsert(attendanceToCreate)
      
      // Refresh global state
      await fetchAllData()
      
      showToast(`Saved ${entriesToCreate.length} entries`)
      onClose()
      setWorkerOutputs({}) // Reset
    } catch (err) {
      console.error(err)
      alert('Failed to save batch entries')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Quick Assign (Piece Work)">
      <form onSubmit={handleSubmit} className={styles.form}>
        <div className={styles.formRow}>
          <div className={styles.formGroup}>
            <label>Date</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
          </div>
          <div className={styles.formGroup}>
            <label>Unit</label>
            <select value={unit} onChange={(e) => setUnit(e.target.value)} required>
              {UNITS.map(u => (
                <option key={u} value={u}>{UNIT_LABELS[u]}</option>
              ))}
            </select>
          </div>
        </div>

        <div className={styles.formGroup}>
          <label>Global Rate (₹/kg) *</label>
          <input 
            type="number" 
            value={globalRate} 
            onChange={(e) => setGlobalRate(e.target.value)} 
            step="0.01" 
            min="0" 
            required 
            placeholder="Applies to all workers below"
          />
        </div>

        <div className={styles.sectionHeader}>
          <h3>Enter Outputs</h3>
        </div>

        <div className={styles.workerInputList}>
          {eligibleWorkers.length > 0 ? (
            eligibleWorkers.map(w => (
              <div key={w.id} className={styles.workerInputRow}>
                <div className={styles.workerInputLabel}>
                  <span className={styles.workerInputEmoji}>{w.emoji}</span>
                  <span>{w.name}</span>
                </div>
                <input 
                  type="number" 
                  className={styles.workerInput}
                  placeholder="kg"
                  step="0.01"
                  min="0"
                  value={workerOutputs[w.id] || ''}
                  onChange={(e) => handleOutputChange(w.id, e.target.value)}
                />
              </div>
            ))
          ) : (
            <div className={styles.infoAlert}>No piece-rate workers found in this unit.</div>
          )}
        </div>

        <div className={styles.formActions}>
          <div /> {/* Spacer */}
          <div className={styles.mainActions}>
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={loading}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading || eligibleWorkers.length === 0}>
              {loading ? 'Saving...' : 'Save All'}
            </button>
          </div>
        </div>
      </form>
    </Modal>
  )
}

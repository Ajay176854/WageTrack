import { useState, useEffect, useMemo } from 'react'
import Modal from '../common/Modal'
import { entriesService } from '../../services/entries.service'
import { attendanceService } from '../../services/attendance.service'
import { useAppContext } from '../../contexts/AppContext'
import { calcPieceWage, calcPackingWage, calcDailyBasePay } from '../../utils/wage'
import { UNITS, UNIT_LABELS } from '../../config/constants'
import { todayStr } from '../../utils/date'
import styles from '../../styles/Modal.module.css'

export default function EntryForm({ isOpen, onClose, entry, defaultUnit }) {
  const { workers, todayAttendance, setEntries, setAttendance, showToast } = useAppContext()
  
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  
  const [formData, setFormData] = useState({
    worker_id: '',
    unit: defaultUnit || 'unit1',
    date: todayStr(),
    category: 'piece_work',
    output: '',
    rate: '',
    pieces: '',
    pack_rate: '',
    assigned_morning: '',
    assigned_afternoon: '',
    wage: 0
  })

  // Filter workers for the selected unit
  const availableWorkers = useMemo(() => {
    return workers.filter(w => w.unit === formData.unit)
  }, [workers, formData.unit])

  // Initialize form
  useEffect(() => {
    if (isOpen) {
      if (entry) {
        setFormData({
          worker_id: entry.worker_id,
          unit: entry.unit,
          date: entry.date,
          category: entry.category,
          output: entry.output || '',
          rate: entry.rate || '',
          pieces: entry.pieces || '',
          pack_rate: entry.pack_rate || '',
          assigned_morning: entry.assigned_morning || '',
          assigned_afternoon: entry.assigned_afternoon || '',
          wage: entry.wage || 0
        })
      } else {
        setFormData({
          worker_id: '',
          unit: defaultUnit || 'unit1',
          date: todayStr(),
          category: 'piece_work',
          output: '',
          rate: '',
          pieces: '',
          pack_rate: '',
          assigned_morning: '',
          assigned_afternoon: '',
          wage: 0
        })
      }
      setError('')
    }
  }, [isOpen, entry, defaultUnit])

  // Update category when worker changes
  useEffect(() => {
    if (formData.worker_id) {
      const worker = workers.find(w => w.id === formData.worker_id)
      if (worker && !entry) {
        setFormData(prev => ({ ...prev, category: worker.category }))
      }
    }
  }, [formData.worker_id, workers, entry])

  // Auto-calculate wage
  useEffect(() => {
    let calculatedWage = 0
    if (formData.category === 'piece_work') {
      calculatedWage = calcPieceWage(formData.output, formData.rate)
    } else if (formData.category === 'bundle_packing' || formData.category === 'cover_packing') {
      const worker = workers.find(w => w.id === formData.worker_id)
      const ratePerPiece = worker?.rate_per_piece || 0
      calculatedWage = calcPackingWage(formData.pieces, formData.pack_rate, ratePerPiece)
    } else {
      // Fixed wage types don't calculate here, they calculate in the UI based on attendance
      const worker = workers.find(w => w.id === formData.worker_id)
      const att = todayAttendance.find(a => a.worker_id === formData.worker_id)
      if (worker) {
         calculatedWage = calcDailyBasePay(worker, att, [])
      }
    }
    
    setFormData(prev => ({ ...prev, wage: calculatedWage }))
  }, [
    formData.category, 
    formData.output, 
    formData.rate, 
    formData.pieces, 
    formData.pack_rate,
    formData.worker_id,
    workers,
    todayAttendance
  ])

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!formData.worker_id) {
      setError('Please select a worker')
      return
    }
    
    setError('')
    setLoading(true)

    try {
      const dataToSave = {
        worker_id: formData.worker_id,
        unit: formData.unit,
        date: formData.date,
        category: formData.category,
        output: Number(formData.output) || 0,
        rate: Number(formData.rate) || 0,
        pieces: Number(formData.pieces) || 0,
        pack_rate: Number(formData.pack_rate) || 0,
        assigned_morning: Number(formData.assigned_morning) || 0,
        assigned_afternoon: Number(formData.assigned_afternoon) || 0,
        wage: Number(formData.wage) || 0
      }

      // Also ensure attendance is marked present
      await attendanceService.upsert({
        worker_id: formData.worker_id,
        unit: formData.unit,
        date: formData.date,
        status: 'present'
      })

      let savedEntry
      if (entry) {
        savedEntry = await entriesService.update(entry.id, dataToSave)
        setEntries(prev => prev.map(e => e.id === savedEntry.id ? savedEntry : e))
        showToast('Entry updated')
      } else {
        savedEntry = await entriesService.upsert(dataToSave)
        setEntries(prev => {
          const filtered = prev.filter(e => !(e.worker_id === savedEntry.worker_id && e.date === savedEntry.date && e.unit === savedEntry.unit))
          return [savedEntry, ...filtered]
        })
        showToast('Entry saved')
      }

      onClose()
    } catch (err) {
      setError(err.message || 'Failed to save entry')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!window.confirm('Delete this entry?')) return
    setLoading(true)
    try {
      await entriesService.delete(entry.id)
      setEntries(prev => prev.filter(e => e.id !== entry.id))
      showToast('Entry deleted')
      onClose()
    } catch (err) {
      setError('Failed to delete entry')
      setLoading(false)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={entry ? 'Edit Entry' : 'New Entry'}>
      <form onSubmit={handleSubmit} className={styles.form}>
        {error && <div className={styles.errorAlert}>{error}</div>}

        <div className={styles.formRow}>
          <div className={styles.formGroup}>
            <label>Date</label>
            <input 
              type="date" 
              name="date" 
              value={formData.date} 
              onChange={handleChange} 
              required 
            />
          </div>
          <div className={styles.formGroup}>
            <label>Unit</label>
            <select name="unit" value={formData.unit} onChange={handleChange} required>
              {UNITS.map(unit => (
                <option key={unit} value={unit}>{UNIT_LABELS[unit]}</option>
              ))}
            </select>
          </div>
        </div>

        <div className={styles.formGroup}>
          <label>Worker *</label>
          <select 
            name="worker_id" 
            value={formData.worker_id} 
            onChange={handleChange} 
            required
            disabled={!!entry} // Don't allow changing worker on edit
          >
            <option value="">Select Worker</option>
            {availableWorkers.map(w => (
              <option key={w.id} value={w.id}>{w.name} ({w.emp_id || 'No ID'})</option>
            ))}
          </select>
        </div>

        {/* Piece Work Fields */}
        {formData.category === 'piece_work' && (
          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label>Output (kg) *</label>
              <input 
                type="number" 
                name="output" 
                value={formData.output} 
                onChange={handleChange} 
                step="0.01"
                min="0"
                required 
              />
            </div>
            <div className={styles.formGroup}>
              <label>Rate (₹) *</label>
              <input 
                type="number" 
                name="rate" 
                value={formData.rate} 
                onChange={handleChange} 
                step="0.01"
                min="0"
                required 
              />
            </div>
          </div>
        )}

        {/* Packing Fields */}
        {(formData.category === 'bundle_packing' || formData.category === 'cover_packing') && (
          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label>Pieces *</label>
              <input 
                type="number" 
                name="pieces" 
                value={formData.pieces} 
                onChange={handleChange} 
                min="0"
                required 
              />
            </div>
            <div className={styles.formGroup}>
              <label>Rate/Piece (₹) *</label>
              <input 
                type="number" 
                name="pack_rate" 
                value={formData.pack_rate} 
                onChange={handleChange} 
                step="0.01"
                min="0"
                required 
              />
            </div>
          </div>
        )}

        {/* Fixed Wage Display */}
        {(formData.category === 'monthly_salary' || formData.category === 'daily_wages') && (
          <div className={styles.infoAlert}>
            Fixed wage calculation is handled automatically based on attendance.
          </div>
        )}

        <div className={styles.totalRow}>
          <span>Calculated Wage:</span>
          <span className={styles.totalValue}>₹{formData.wage}</span>
        </div>

        <div className={styles.formActions}>
          {entry && (
            <button 
              type="button" 
              className={styles.deleteBtn} 
              onClick={handleDelete}
              disabled={loading}
            >
              Delete
            </button>
          )}
          <div className={styles.mainActions}>
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={loading}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Saving...' : 'Save Entry'}
            </button>
          </div>
        </div>
      </form>
    </Modal>
  )
}

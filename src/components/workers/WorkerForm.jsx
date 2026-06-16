import { useState, useEffect } from 'react'
import Modal from '../common/Modal'
import { workersService } from '../../services/workers.service'
import { useAppContext } from '../../contexts/AppContext'
import { useAuth } from '../../hooks/useAuth'
import { UNITS, CATEGORIES, WORKER_EMOJIS, UNIT_LABELS, CATEGORY_LABELS } from '../../config/constants'
import { getAccessibleProductions } from '../../utils/permissions'
import styles from '../../styles/Modal.module.css'

export default function WorkerForm({ isOpen, onClose, worker, defaultUnit }) {
  const { showToast, setWorkers } = useAppContext()
  const { profile, isAdmin } = useAuth()
  
  const accessibleUnits = getAccessibleProductions(profile)
  
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  
  const [formData, setFormData] = useState({
    name: '',
    emp_id: '',
    phone: '',
    unit: defaultUnit || 'unit1',
    category: 'piece_work',
    salary: 0,
    daily_wage: 0,
    paid_leaves: 0,
    rate_per_piece: 0
  })

  // Reset form when opened
  useEffect(() => {
    if (isOpen) {
      if (worker) {
        setFormData({
          name: worker.name || '',
          emp_id: worker.emp_id || '',
          phone: worker.phone || '',
          unit: worker.unit || defaultUnit || 'unit1',
          category: worker.category || 'piece_work',
          salary: worker.salary || 0,
          daily_wage: worker.daily_wage || 0,
          paid_leaves: worker.paid_leaves || 0,
          rate_per_piece: worker.rate_per_piece || 0
        })
      } else {
        setFormData({
          name: '',
          emp_id: '',
          phone: '',
          unit: defaultUnit || 'unit1',
          category: 'piece_work',
          salary: 0,
          daily_wage: 0,
          paid_leaves: 0,
          rate_per_piece: 0
        })
      }
      setError('')
    }
  }, [isOpen, worker, defaultUnit])

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      // Validate permissions
      if (!isAdmin && !accessibleUnits.includes(formData.unit)) {
        throw new Error('You do not have permission to add workers to this unit')
      }

      // Validate emp_id uniqueness
      if (formData.emp_id) {
        const exists = await workersService.empIdExists(formData.emp_id, worker?.id)
        if (exists) {
          throw new Error('Employee ID already exists')
        }
      }

      // Prepare data
      const dataToSave = {
        name: formData.name,
        emp_id: formData.emp_id || null,
        phone: formData.phone || null,
        unit: formData.unit,
        category: formData.category,
        salary: Number(formData.salary) || 0,
        daily_wage: Number(formData.daily_wage) || 0,
        paid_leaves: Number(formData.paid_leaves) || 0,
        rate_per_piece: Number(formData.rate_per_piece) || 0
      }

      if (worker) {
        // Update
        const updatedWorker = await workersService.update(worker.id, dataToSave)
        setWorkers(prev => prev.map(w => w.id === updatedWorker.id ? updatedWorker : w))
        showToast('Worker updated successfully')
      } else {
        // Create
        // Assign a random emoji for new workers
        dataToSave.emoji = WORKER_EMOJIS[Math.floor(Math.random() * WORKER_EMOJIS.length)]
        const newWorker = await workersService.create(dataToSave)
        setWorkers(prev => [...prev, newWorker])
        showToast('Worker added successfully')
      }

      onClose()
    } catch (err) {
      setError(err.message || 'Failed to save worker')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!window.confirm(`Are you sure you want to remove ${worker.name}? This will hide them from active lists.`)) return
    
    setLoading(true)
    try {
      await workersService.softDelete(worker.id)
      setWorkers(prev => prev.filter(w => w.id !== worker.id))
      showToast('Worker removed')
      onClose()
    } catch (err) {
      setError(err.message || 'Failed to remove worker')
      setLoading(false)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={worker ? 'Edit Worker' : 'Add New Worker'}>
      <form onSubmit={handleSubmit} className={styles.form}>
        {error && <div className={styles.errorAlert}>{error}</div>}

        <div className={styles.formGroup}>
          <label>Full Name *</label>
          <input 
            type="text" 
            name="name" 
            value={formData.name} 
            onChange={handleChange} 
            required 
            placeholder="Worker's name"
          />
        </div>

        <div className={styles.formRow}>
          <div className={styles.formGroup}>
            <label>Employee ID</label>
            <input 
              type="text" 
              name="emp_id" 
              value={formData.emp_id} 
              onChange={handleChange} 
              placeholder="Optional"
            />
          </div>
          <div className={styles.formGroup}>
            <label>Phone Number</label>
            <input 
              type="tel" 
              name="phone" 
              value={formData.phone} 
              onChange={handleChange} 
              placeholder="Optional"
            />
          </div>
        </div>

        <div className={styles.formRow}>
          <div className={styles.formGroup}>
            <label>Unit *</label>
            <select name="unit" value={formData.unit} onChange={handleChange} required>
              {UNITS.map(unit => (
                <option 
                  key={unit} 
                  value={unit} 
                  disabled={!isAdmin && !accessibleUnits.includes(unit)}
                >
                  {UNIT_LABELS[unit]} {!isAdmin && !accessibleUnits.includes(unit) ? '(No access)' : ''}
                </option>
              ))}
            </select>
          </div>
          <div className={styles.formGroup}>
            <label>Category *</label>
            <select name="category" value={formData.category} onChange={handleChange} required>
              {CATEGORIES.map(cat => (
                <option key={cat} value={cat}>{CATEGORY_LABELS[cat]}</option>
              ))}
            </select>
          </div>
        </div>

        {formData.category === 'monthly_salary' && (
          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label>Monthly Salary (₹)</label>
              <input 
                type="number" 
                name="salary" 
                value={formData.salary} 
                onChange={handleChange} 
                min="0"
                required
              />
            </div>
            <div className={styles.formGroup}>
              <label>Paid Leaves (Days)</label>
              <input 
                type="number" 
                name="paid_leaves" 
                value={formData.paid_leaves} 
                onChange={handleChange} 
                min="0"
                step="0.5"
              />
            </div>
          </div>
        )}

        {formData.category === 'daily_wages' && (
          <div className={styles.formGroup}>
            <label>Daily Wage Rate (₹)</label>
            <input 
              type="number" 
              name="daily_wage" 
              value={formData.daily_wage} 
              onChange={handleChange} 
              min="0"
              required
            />
          </div>
        )}

        {(formData.category === 'bundle_packing' || formData.category === 'cover_packing') && (
          <div className={styles.formGroup}>
            <label>Rate Per Piece (₹)</label>
            <input 
              type="number" 
              name="rate_per_piece" 
              value={formData.rate_per_piece} 
              onChange={handleChange} 
              min="0"
              step="0.01"
              required
            />
          </div>
        )}

        <div className={styles.formActions}>
          {worker && (
            <button 
              type="button" 
              className={styles.deleteBtn} 
              onClick={handleDelete}
              disabled={loading}
            >
              Remove
            </button>
          )}
          <div className={styles.mainActions}>
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={loading}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Saving...' : 'Save Worker'}
            </button>
          </div>
        </div>
      </form>
    </Modal>
  )
}

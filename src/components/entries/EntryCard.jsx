import { CATEGORY_LABELS, UNIT_COLORS } from '../../config/constants'
import { formatCurrency } from '../../utils/helpers'
import { useAppContext } from '../../contexts/AppContext'
import styles from '../../styles/Dashboard.module.css'

export default function EntryCard({ entry, onClick }) {
  const { workers } = useAppContext()
  const worker = workers.find(w => w.id === entry.worker_id)
  
  if (!worker) return null
  
  const unitColor = UNIT_COLORS[entry.unit] || UNIT_COLORS.unit1
  
  // Format summary based on category
  let summary = ''
  if (entry.category === 'piece_work') {
    summary = `${entry.output || 0} kg @ ₹${entry.rate || 0}/kg`
  } else if (entry.category === 'bundle_packing' || entry.category === 'cover_packing') {
    summary = `${entry.pieces || 0} pcs @ ₹${entry.pack_rate || 0}/pc`
  } else if (entry.category === 'monthly_salary' || entry.category === 'daily_wages') {
    summary = 'Fixed Wage'
  }

  return (
    <div className={styles.entryCard} onClick={onClick}>
      <div className={styles.entryAvatar}>
        {worker.emoji || '👷'}
      </div>
      
      <div className={styles.entryInfo}>
        <div className={styles.entryNameRow}>
          <span className={styles.entryName}>{worker.name}</span>
          <span 
            className={styles.entryUnit}
            style={{ color: unitColor.color, backgroundColor: unitColor.bg }}
          >
            {entry.unit.replace('unit', 'U')}
          </span>
        </div>
        <div className={styles.entrySummary}>{summary}</div>
      </div>
      
      <div className={styles.entryWage}>
        {formatCurrency(entry.wage)}
      </div>
    </div>
  )
}

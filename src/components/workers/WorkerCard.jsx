import { CATEGORY_LABELS, UNIT_COLORS } from '../../config/constants'
import { formatCurrency } from '../../utils/helpers'
import styles from '../../styles/Workers.module.css'

export default function WorkerCard({ worker, onEdit, onClick }) {
  const unitColor = UNIT_COLORS[worker.unit] || UNIT_COLORS.unit1
  
  return (
    <div className={styles.workerCard} onClick={onClick}>
      <div className={styles.workerAvatar}>
        {worker.emoji || '👷'}
      </div>
      
      <div className={styles.workerInfo}>
        <div className={styles.workerNameRow}>
          <h4 className={styles.workerName}>{worker.name}</h4>
          {worker.emp_id && <span className={styles.workerId}>#{worker.emp_id}</span>}
        </div>
        
        <div className={styles.workerMeta}>
          <span 
            className={styles.unitBadge} 
            style={{ color: unitColor.color, backgroundColor: unitColor.bg }}
          >
            {worker.unit.replace('unit', 'Unit ')}
          </span>
          <span className={styles.categoryBadge}>
            {CATEGORY_LABELS[worker.category] || worker.category}
          </span>
        </div>
        
        <div className={styles.workerWage}>
          {worker.category === 'monthly_salary' && `Salary: ${formatCurrency(worker.salary)}/mo`}
          {worker.category === 'daily_wages' && `Wage: ${formatCurrency(worker.daily_wage)}/day`}
          {(worker.category === 'piece_work' || worker.category.includes('packing')) && 'Piece Rate Worker'}
        </div>
      </div>
      
      <button 
        className={styles.editBtn} 
        onClick={onEdit}
        aria-label="Edit worker"
      >
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
        </svg>
      </button>
    </div>
  )
}

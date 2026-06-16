import { statusColor } from '../../utils/helpers'
import styles from '../../styles/components.module.css'

export default function StatusBadge({ status }) {
  const color = statusColor(status)
  
  const labels = {
    present: 'P',
    absent: 'A',
    forenoon: 'FN',
    afternoon: 'AN',
  }
  
  const label = labels[status] || status || '-'
  
  return (
    <span 
      className={styles.statusBadge}
      style={{
        backgroundColor: `${color}15`,
        color: color,
        border: `1px solid ${color}30`
      }}
    >
      {label}
    </span>
  )
}

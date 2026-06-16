import styles from '../../styles/components.module.css'

export default function EmptyState({ title, message, icon }) {
  return (
    <div className={styles.emptyState}>
      <div className={styles.emptyIcon}>
        {icon || (
          <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
            <line x1="9" y1="9" x2="15" y2="15" />
            <line x1="15" y1="9" x2="9" y2="15" />
          </svg>
        )}
      </div>
      <h3 className={styles.emptyTitle}>{title}</h3>
      <p className={styles.emptyMessage}>{message}</p>
    </div>
  )
}

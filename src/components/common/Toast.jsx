import styles from '../../styles/Toast.module.css'

export default function Toast({ message }) {
  if (!message) return null

  return (
    <div className={styles.toastContainer}>
      <div className={styles.toast}>
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
        <span>{message}</span>
      </div>
    </div>
  )
}

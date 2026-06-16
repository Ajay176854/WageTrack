import { useAuth } from '../../hooks/useAuth'
import { useAppContext } from '../../contexts/AppContext'
import { useNavigate } from 'react-router-dom'
import styles from '../../styles/Header.module.css'

export default function Header() {
  const { profile, isAdmin } = useAuth()
  const { workers, fetchAllData } = useAppContext()
  const navigate = useNavigate()

  const workerCount = workers.length

  return (
    <header className={styles.header}>
      <div className={styles.headerTitle}>
        <div className={styles.headerLogo}>
          <img src="/logo.png" alt="WageTrack" />
          <div className={styles.statusDot} />
        </div>
        <span className={styles.brand}>
          Wage<span className={styles.brandAccent}>Track</span>
        </span>
      </div>

      <div className={styles.headerActions}>
        {isAdmin && (
          <button
            className={styles.iconBtn}
            onClick={() => navigate('/users')}
            aria-label="Users"
          >
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
            </svg>
          </button>
        )}

        <button
          className={styles.iconBtn}
          onClick={fetchAllData}
          aria-label="Refresh"
        >
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21.5 2v6h-6M2.5 22v-6h6M2 12c0-4.4 3.6-8 8-8 3.3 0 6.2 2 7.4 5M22 12c0 4.4-3.6 8-8 8-3.3 0-6.2-2-7.4-5" />
          </svg>
        </button>

        <div className={styles.workerBadge}>
          {workerCount} worker{workerCount !== 1 ? 's' : ''}
        </div>
      </div>
    </header>
  )
}

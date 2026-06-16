import { useState, useMemo } from 'react'
import { useAppContext } from '../contexts/AppContext'
import { useAuth } from '../hooks/useAuth'
import UnitTabs from '../components/common/UnitTabs'
import EmptyState from '../components/common/EmptyState'
import EntryCard from '../components/entries/EntryCard'
import EntryForm from '../components/entries/EntryForm'
import QuickAssign from '../components/entries/QuickAssign'
import { formatDateWithDay } from '../utils/date'
import styles from '../styles/Dashboard.module.css'

export default function HomePage() {
  const { 
    today, 
    todayEntries, 
    todayAttendance, 
    workers, 
    currentUnit, 
    setCurrentUnit 
  } = useAppContext()
  const { profile } = useAuth()
  
  const [isEntryFormOpen, setIsEntryFormOpen] = useState(false)
  const [isQuickAssignOpen, setIsQuickAssignOpen] = useState(false)
  const [selectedEntry, setSelectedEntry] = useState(null)

  // Filter entries based on selected unit and permissions
  const visibleEntries = useMemo(() => {
    let filtered = todayEntries
    if (currentUnit !== 'all') {
      filtered = filtered.filter(e => e.unit === currentUnit)
    } else {
      // If "all", only show units user has access to
      const allowedUnits = Object.keys(profile?.access || {}).filter(k => profile.access[k].length > 0)
      if (profile?.role !== 'admin') {
        filtered = filtered.filter(e => allowedUnits.includes(e.unit))
      }
    }
    return filtered
  }, [todayEntries, currentUnit, profile])

  // Calculate dashboard stats
  const stats = useMemo(() => {
    let activeWorkers = workers
    if (currentUnit !== 'all') {
      activeWorkers = workers.filter(w => w.unit === currentUnit)
    }

    const presentCount = todayAttendance.filter(a => 
      (currentUnit === 'all' || a.unit === currentUnit) && 
      (a.status === 'present' || a.status === 'forenoon' || a.status === 'afternoon')
    ).length

    const totalWage = visibleEntries.reduce((sum, e) => sum + (e.wage || 0), 0)

    return {
      present: presentCount,
      totalWorkers: activeWorkers.length,
      totalWage,
      entryCount: visibleEntries.length
    }
  }, [workers, currentUnit, todayAttendance, visibleEntries])

  const handleEditEntry = (entry) => {
    setSelectedEntry(entry)
    setIsEntryFormOpen(true)
  }

  const handleCloseForm = () => {
    setSelectedEntry(null)
    setIsEntryFormOpen(false)
  }

  return (
    <div className={styles.container}>
      <div className={styles.dateHeader}>
        <h2>{formatDateWithDay(today)}</h2>
        <span className={styles.badge}>Today</span>
      </div>

      <UnitTabs 
        activeUnit={currentUnit} 
        onChange={setCurrentUnit} 
        includeMaintenance={true} 
      />

      {/* Dashboard Stats */}
      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <div className={styles.statIcon} style={{ color: 'var(--accent2)', backgroundColor: 'rgba(74,222,128,0.1)' }}>
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
          </div>
          <div className={styles.statInfo}>
            <div className={styles.statValue}>{stats.present} <span className={styles.statMax}>/ {stats.totalWorkers}</span></div>
            <div className={styles.statLabel}>Present Today</div>
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statIcon} style={{ color: 'var(--accent)', backgroundColor: 'rgba(240,192,64,0.1)' }}>
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
            </svg>
          </div>
          <div className={styles.statInfo}>
            <div className={styles.statValue}>₹{stats.totalWage.toLocaleString('en-IN')}</div>
            <div className={styles.statLabel}>Est. Wage</div>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className={styles.actions}>
        <button className="btn btn-primary" onClick={() => setIsEntryFormOpen(true)}>
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          New Entry
        </button>
        <button className="btn btn-secondary" onClick={() => setIsQuickAssignOpen(true)}>
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><polyline points="13 2 13 9 20 9"/>
          </svg>
          Quick Assign
        </button>
      </div>

      {/* Entries List */}
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <h3>Today's Work ({stats.entryCount})</h3>
        </div>

        <div className={styles.entriesList}>
          {visibleEntries.length > 0 ? (
            visibleEntries.map(entry => (
              <EntryCard 
                key={entry.id} 
                entry={entry} 
                onClick={() => handleEditEntry(entry)} 
              />
            ))
          ) : (
            <EmptyState 
              title="No entries today" 
              message="Add new entries or use Quick Assign for multiple workers."
            />
          )}
        </div>
      </div>

      {/* Modals */}
      <EntryForm 
        isOpen={isEntryFormOpen} 
        onClose={handleCloseForm} 
        entry={selectedEntry} 
        defaultUnit={currentUnit !== 'all' ? currentUnit : 'unit1'}
      />

      <QuickAssign 
        isOpen={isQuickAssignOpen} 
        onClose={() => setIsQuickAssignOpen(false)} 
        defaultUnit={currentUnit !== 'all' ? currentUnit : 'unit1'}
      />
    </div>
  )
}

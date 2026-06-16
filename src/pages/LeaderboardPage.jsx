import { useMemo } from 'react'
import { useAppContext } from '../contexts/AppContext'
import { UNIT_COLORS } from '../config/constants'
import { formatCurrency } from '../utils/helpers'
import UnitTabs from '../components/common/UnitTabs'
import styles from '../styles/Dashboard.module.css' // Reusing some card styles

export default function LeaderboardPage() {
  const { workers, todayEntries, currentUnit, setCurrentUnit } = useAppContext()

  const leaders = useMemo(() => {
    // Only piece workers make sense for leaderboard
    let eligible = todayEntries.filter(e => e.category === 'piece_work')
    
    if (currentUnit !== 'all') {
      eligible = eligible.filter(e => e.unit === currentUnit)
    }

    const aggregated = {}
    eligible.forEach(e => {
      if (!aggregated[e.worker_id]) {
        aggregated[e.worker_id] = { worker_id: e.worker_id, output: 0, wage: 0, unit: e.unit }
      }
      aggregated[e.worker_id].output += e.output || 0
      aggregated[e.worker_id].wage += e.wage || 0
    })

    const sorted = Object.values(aggregated).sort((a, b) => b.output - a.output)
    
    // Map worker data
    return sorted.map((item, index) => {
      const w = workers.find(w => w.id === item.worker_id)
      return {
        ...item,
        name: w?.name || 'Unknown',
        emoji: w?.emoji || '👷',
        rank: index + 1
      }
    })
  }, [todayEntries, currentUnit, workers])

  return (
    <div className={styles.container}>
      <div className={styles.dateHeader}>
        <h2>Top Performers</h2>
        <span className={styles.badge}>Today</span>
      </div>

      <UnitTabs activeUnit={currentUnit} onChange={setCurrentUnit} />

      <div style={{ marginTop: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {leaders.length > 0 ? (
          leaders.map(leader => {
            const unitColor = UNIT_COLORS[leader.unit] || UNIT_COLORS.unit1
            const isTop3 = leader.rank <= 3
            
            return (
              <div 
                key={leader.worker_id} 
                className={styles.entryCard}
                style={isTop3 ? { border: `1px solid ${leader.rank === 1 ? '#fbbf24' : leader.rank === 2 ? '#94a3b8' : '#b45309'}` } : {}}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <div style={{ 
                    fontSize: '1.5rem', 
                    fontWeight: 'bold', 
                    color: leader.rank === 1 ? '#fbbf24' : leader.rank === 2 ? '#94a3b8' : leader.rank === 3 ? '#b45309' : 'var(--text-secondary)',
                    width: '24px',
                    textAlign: 'center'
                  }}>
                    #{leader.rank}
                  </div>
                  <div className={styles.entryAvatar}>{leader.emoji}</div>
                  <div>
                    <div className={styles.entryName}>{leader.name}</div>
                    <div className={styles.entrySummary}>
                      <span style={{ color: unitColor.color, marginRight: '8px' }}>{leader.unit.replace('unit', 'U')}</span>
                      {leader.output} kg
                    </div>
                  </div>
                </div>
                <div className={styles.entryWage}>{formatCurrency(leader.wage)}</div>
              </div>
            )
          })
        ) : (
          <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-secondary)' }}>
            No piece-work entries today to rank.
          </div>
        )}
      </div>
    </div>
  )
}

import { UNIT_LABELS } from '../../config/constants'
import { getAccessibleProductions } from '../../utils/permissions'
import { useAuth } from '../../hooks/useAuth'
import styles from '../../styles/components.module.css'

export default function UnitTabs({ activeUnit, onChange, includeAll = true, includeMaintenance = false }) {
  const { profile } = useAuth()
  
  const accessibleUnits = getAccessibleProductions(profile)
  
  let tabs = []
  if (includeAll) {
    tabs.push({ id: 'all', label: 'All Units' })
  }
  
  accessibleUnits.forEach(unit => {
    tabs.push({ id: unit, label: UNIT_LABELS[unit] })
  })
  
  if (includeMaintenance && profile?.access?.maintenance?.length > 0) {
    tabs.push({ id: 'maintenance', label: 'Maintenance' })
  }

  return (
    <div className={styles.unitTabsWrapper}>
      <div className={styles.unitTabs}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={`${styles.tab} ${activeUnit === tab.id ? styles.active : ''}`}
            onClick={() => onChange(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>
    </div>
  )
}

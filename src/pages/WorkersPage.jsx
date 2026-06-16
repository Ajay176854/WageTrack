import { useState, useMemo } from 'react'
import { useAppContext } from '../contexts/AppContext'
import UnitTabs from '../components/common/UnitTabs'
import SearchInput from '../components/common/SearchInput'
import EmptyState from '../components/common/EmptyState'
import WorkerCard from '../components/workers/WorkerCard'
import WorkerForm from '../components/workers/WorkerForm'
import WorkerProfile from '../components/workers/WorkerProfile'
import styles from '../styles/Workers.module.css'

export default function WorkersPage() {
  const { workers, currentUnit, setCurrentUnit } = useAppContext()
  
  const [searchQuery, setSearchQuery] = useState('')
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [isProfileOpen, setIsProfileOpen] = useState(false)
  const [selectedWorker, setSelectedWorker] = useState(null)

  const filteredWorkers = useMemo(() => {
    return workers.filter(w => {
      // Unit filter
      if (currentUnit !== 'all' && w.unit !== currentUnit) return false
      
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase()
        return (
          w.name.toLowerCase().includes(query) || 
          (w.emp_id && w.emp_id.toLowerCase().includes(query)) ||
          w.category.toLowerCase().includes(query)
        )
      }
      
      return true
    })
  }, [workers, currentUnit, searchQuery])

  const handleEdit = (worker, e) => {
    e.stopPropagation()
    setSelectedWorker(worker)
    setIsFormOpen(true)
  }

  const handleViewProfile = (worker) => {
    setSelectedWorker(worker)
    setIsProfileOpen(true)
  }

  const handleAddNew = () => {
    setSelectedWorker(null)
    setIsFormOpen(true)
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2>Workers Directory</h2>
        <button className="btn btn-primary" onClick={handleAddNew}>
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          Add Worker
        </button>
      </div>

      <UnitTabs activeUnit={currentUnit} onChange={setCurrentUnit} />

      <div className={styles.searchWrap}>
        <SearchInput 
          value={searchQuery} 
          onChange={setSearchQuery} 
          placeholder="Search by name, ID or category..." 
        />
      </div>

      <div className={styles.workersList}>
        {filteredWorkers.length > 0 ? (
          filteredWorkers.map(worker => (
            <WorkerCard 
              key={worker.id} 
              worker={worker} 
              onEdit={(e) => handleEdit(worker, e)}
              onClick={() => handleViewProfile(worker)}
            />
          ))
        ) : (
          <EmptyState 
            title="No workers found" 
            message={searchQuery ? "Try adjusting your search query." : "Add a new worker to get started."}
          />
        )}
      </div>

      <WorkerForm 
        isOpen={isFormOpen} 
        onClose={() => setIsFormOpen(false)} 
        worker={selectedWorker} 
        defaultUnit={currentUnit !== 'all' ? currentUnit : 'unit1'}
      />

      <WorkerProfile 
        isOpen={isProfileOpen} 
        onClose={() => setIsProfileOpen(false)} 
        worker={selectedWorker} 
      />
    </div>
  )
}

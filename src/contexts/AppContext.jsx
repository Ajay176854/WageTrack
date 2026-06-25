import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { useAuthContext } from './AuthContext'
import { workersService } from '../services/workers.service'
import { entriesService } from '../services/entries.service'
import { attendanceService } from '../services/attendance.service'
import { maintenanceService } from '../services/maintenance.service'
import { todayStr } from '../utils/date'

const AppContext = createContext(null)

export function AppProvider({ children }) {
  const { profile } = useAuthContext()

  const [workers, setWorkers] = useState([])
  const [entries, setEntries] = useState([])
  const [attendance, setAttendance] = useState([])
  const [maintenance, setMaintenance] = useState([])
  const [dataLoading, setDataLoading] = useState(false)
  const [currentUnit, setCurrentUnit] = useState('all')
  const [toast, setToast] = useState({ message: '', visible: false })

  // ── Data fetching ──────────────────────────────────────────────────────────
  const fetchAllData = useCallback(async () => {
    if (!profile) return
    setDataLoading(true)
    try {
      const results = await Promise.allSettled([
        workersService.getAll(),
        entriesService.getAll(),
        attendanceService.getAll(),
        maintenanceService.getAll(),
      ])

      const [workersResult, entriesResult, attendanceResult, maintenanceResult] = results

      if (workersResult.status === 'fulfilled') setWorkers(workersResult.value)
      else console.error('Workers fetch failed:', workersResult.reason)

      if (entriesResult.status === 'fulfilled') setEntries(entriesResult.value)
      else console.error('Entries fetch failed:', entriesResult.reason)

      if (attendanceResult.status === 'fulfilled') setAttendance(attendanceResult.value)
      else console.error('Attendance fetch failed:', attendanceResult.reason)

      if (maintenanceResult.status === 'fulfilled') setMaintenance(maintenanceResult.value)
      else console.error('Maintenance fetch failed:', maintenanceResult.reason)
    } catch (err) {
      console.error('Failed to fetch data:', err)
      showToast('Failed to load data')
    } finally {
      setDataLoading(false)
    }
  }, [profile])

  // Load data when profile is available
  useEffect(() => {
    if (profile) {
      fetchAllData()
    }
  }, [profile, fetchAllData])

  // ── Real-time subscriptions ────────────────────────────────────────────────
  useEffect(() => {
    if (!profile) return

    const workersSub = workersService.subscribe(() => {
      workersService.getAll().then(setWorkers).catch(console.error)
    })

    const entriesSub = entriesService.subscribe(() => {
      entriesService.getAll().then(setEntries).catch(console.error)
    })

    const attendanceSub = attendanceService.subscribe(() => {
      attendanceService.getAll().then(setAttendance).catch(console.error)
    })

    const maintenanceSub = maintenanceService.subscribe(() => {
      maintenanceService.getAll().then(setMaintenance).catch(console.error)
    })

    return () => {
      workersSub.unsubscribe()
      entriesSub.unsubscribe()
      attendanceSub.unsubscribe()
      maintenanceSub.unsubscribe()
    }
  }, [profile])

  // ── Toast helper ───────────────────────────────────────────────────────────
  const showToast = useCallback((message) => {
    setToast({ message, visible: true })
    setTimeout(() => setToast({ message: '', visible: false }), 2500)
  }, [])

  // ── Derived data ───────────────────────────────────────────────────────────
  const today = todayStr()

  const todayEntries = entries.filter((e) => e.date === today)
  const todayAttendance = attendance.filter((a) => a.date === today)

  const value = {
    // Data
    workers,
    entries,
    attendance,
    maintenance,
    dataLoading,

    // Setters (for optimistic updates)
    setWorkers,
    setEntries,
    setAttendance,
    setMaintenance,

    // Derived
    todayEntries,
    todayAttendance,
    today,

    // UI state
    currentUnit,
    setCurrentUnit,
    toast,
    showToast,

    // Actions
    fetchAllData,
  }

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useAppContext() {
  const context = useContext(AppContext)
  if (!context) {
    throw new Error('useAppContext must be used within an AppProvider')
  }
  return context
}

export default AppContext

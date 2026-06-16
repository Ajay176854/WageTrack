import { useState, useEffect } from 'react'
import { useAuth } from '../hooks/useAuth'
import { usersService } from '../services/users.service'
import { authService } from '../services/auth.service'
import EmptyState from '../components/common/EmptyState'
import Modal from '../components/common/Modal'
import { UNIT_LABELS } from '../config/constants'
import styles from '../styles/Workers.module.css'

export default function UsersPage() {
  const { isAdmin } = useAuth()
  
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [error, setError] = useState('')

  // Form state
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    role: 'supervisor',
    access: { unit1: [], unit2: [], unit3: [], unit4: [], maintenance: [] }
  })

  useEffect(() => {
    if (isAdmin) {
      loadUsers()
    }
  }, [isAdmin])

  const loadUsers = async () => {
    setLoading(true)
    try {
      const data = await usersService.getAll()
      setUsers(data)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleAccessChange = (unit, perm) => {
    setFormData(prev => {
      const currentAccess = prev.access[unit] || []
      let newAccess
      if (currentAccess.includes(perm)) {
        newAccess = currentAccess.filter(p => p !== perm)
      } else {
        newAccess = [...currentAccess, perm]
      }
      return { ...prev, access: { ...prev.access, [unit]: newAccess } }
    })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    try {
      // Must use Supabase Auth to create the user, which triggers edge function / inserts to users table
      // Note: for this to work perfectly, you need a Supabase edge function or to be authenticated as a service role.
      // For standard client-side signup:
      await authService.signUp({
        email: formData.email,
        password: formData.password,
        username: formData.username,
        role: formData.role,
        access: formData.access
      })
      
      setIsFormOpen(false)
      loadUsers()
    } catch (err) {
      setError(err.message)
    }
  }

  if (!isAdmin) {
    return <EmptyState title="Access Denied" message="Only administrators can manage users." />
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2>User Management</h2>
        <button className="btn btn-primary" onClick={() => setIsFormOpen(true)}>Add User</button>
      </div>

      {loading ? (
        <div>Loading users...</div>
      ) : (
        <div className={styles.workersList}>
          {users.map(u => (
            <div key={u.id} className={styles.workerCard}>
              <div className={styles.workerInfo}>
                <div className={styles.workerNameRow}>
                  <h4 className={styles.workerName}>{u.username}</h4>
                  <span className={styles.workerId}>{u.role}</span>
                </div>
                <div className={styles.workerWage}>{u.email}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal isOpen={isFormOpen} onClose={() => setIsFormOpen(false)} title="Add Supervisor">
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {error && <div style={{ color: 'red' }}>{error}</div>}
          
          <div>
            <label>Username</label>
            <input type="text" value={formData.username} onChange={e => setFormData(p => ({...p, username: e.target.value}))} required className="w-full p-2 border rounded" />
          </div>
          <div>
            <label>Email</label>
            <input type="email" value={formData.email} onChange={e => setFormData(p => ({...p, email: e.target.value}))} required className="w-full p-2 border rounded" />
          </div>
          <div>
            <label>Password (min 6 chars)</label>
            <input type="password" value={formData.password} onChange={e => setFormData(p => ({...p, password: e.target.value}))} required minLength={6} className="w-full p-2 border rounded" />
          </div>
          
          <div>
            <h4>Access Permissions</h4>
            {Object.keys(UNIT_LABELS).map(unit => (
              <div key={unit} style={{ margin: '8px 0', padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }}>
                <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>{UNIT_LABELS[unit]}</div>
                <label style={{ marginRight: '12px' }}>
                  <input type="checkbox" checked={(formData.access[unit] || []).includes('attendance')} onChange={() => handleAccessChange(unit, 'attendance')} /> Attendance
                </label>
                <label style={{ marginRight: '12px' }}>
                  <input type="checkbox" checked={(formData.access[unit] || []).includes('work')} onChange={() => handleAccessChange(unit, 'work')} /> Work
                </label>
                <label>
                  <input type="checkbox" checked={(formData.access[unit] || []).includes('payment')} onChange={() => handleAccessChange(unit, 'payment')} /> Payment
                </label>
              </div>
            ))}
          </div>

          <button type="submit" className="btn btn-primary mt-4">Create User</button>
        </form>
      </Modal>
    </div>
  )
}

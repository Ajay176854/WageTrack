import { Outlet } from 'react-router-dom'
import Header from './Header'
import BottomNav from './BottomNav'
import Toast from '../common/Toast'
import { useAppContext } from '../../contexts/AppContext'
import styles from '../../styles/Layout.module.css'

export default function Layout() {
  const { toast } = useAppContext()

  return (
    <div className={styles.app}>
      <Header />
      <main className={styles.main}>
        <Outlet />
      </main>
      <BottomNav />
      {toast.visible && <Toast message={toast.message} />}
    </div>
  )
}

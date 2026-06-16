import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './hooks/useAuth'
import Layout from './components/layout/Layout.jsx'
import ProtectedRoute from './components/layout/ProtectedRoute.jsx'
import LoginPage from './pages/LoginPage.jsx'
import HomePage from './pages/HomePage.jsx'
import WorkersPage from './pages/WorkersPage.jsx'
import ReportsPage from './pages/ReportsPage.jsx'
import AttendancePage from './pages/AttendancePage.jsx'
import LeaderboardPage from './pages/LeaderboardPage.jsx'
import UsersPage from './pages/UsersPage.jsx'

export default function App() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="app-loader">
        <div className="loader-logo">
          <img src="/logo.png" alt="WageTrack" />
        </div>
        <div className="loader-text">Wage<span>Track</span></div>
        <div className="loader-spinner" />
      </div>
    )
  }

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <LoginPage />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<Layout />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/workers" element={<WorkersPage />} />
          <Route path="/reports" element={<ReportsPage />} />
          <Route path="/attendance" element={<AttendancePage />} />
          <Route path="/leaderboard" element={<LeaderboardPage />} />
          <Route path="/users" element={<UsersPage />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

import { Navigate, Route, Routes, useLocation } from 'react-router'
import { useAuth } from './lib/auth/AuthProvider.jsx'
import BoardPage from './pages/BoardPage.jsx'
import GymPage from './pages/GymPage.jsx'
import LandingPage from './pages/LandingPage.jsx'
import LoginPage from './pages/LoginPage.jsx'
import NotesPage from './pages/NotesPage.jsx'
import ProgressPage from './pages/ProgressPage.jsx'

export function RequireAuth({ children }) {
  const { user } = useAuth()
  const location = useLocation()
  if (!user) return <Navigate to={`/login?next=${encodeURIComponent(location.pathname)}`} replace />
  return children
}

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/board"
        element={
          <RequireAuth>
            <BoardPage />
          </RequireAuth>
        }
      />
      <Route
        path="/gym/:id"
        element={
          <RequireAuth>
            <GymPage />
          </RequireAuth>
        }
      />
      {/* One route for the list and an open note, so opening a note doesn't reload the list. */}
      <Route
        path="/notes/:id?"
        element={
          <RequireAuth>
            <NotesPage />
          </RequireAuth>
        }
      />
      <Route
        path="/progress"
        element={
          <RequireAuth>
            <ProgressPage />
          </RequireAuth>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

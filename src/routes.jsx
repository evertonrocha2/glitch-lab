import { Navigate, Route, Routes, useLocation } from 'react-router'
import { useAuth } from './lib/auth/AuthProvider.jsx'
import ArticleEditorPage from './pages/ArticleEditorPage.jsx'
import ArticlePage from './pages/ArticlePage.jsx'
import ArticlesPage from './pages/ArticlesPage.jsx'
import BoardPage from './pages/BoardPage.jsx'
import DailyPage from './pages/DailyPage.jsx'
import GymPage from './pages/GymPage.jsx'
import LandingPage from './pages/LandingPage.jsx'
import LoginPage from './pages/LoginPage.jsx'
import NotesPage from './pages/NotesPage.jsx'
import ProfilePage from './pages/ProfilePage.jsx'
import ProgressPage from './pages/ProgressPage.jsx'
import PublicProfilePage from './pages/PublicProfilePage.jsx'
import PeoplePage from './pages/PeoplePage.jsx'
import PublicNotePage from './pages/PublicNotePage.jsx'
import TrailPage from './pages/TrailPage.jsx'

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
      <Route
        path="/daily"
        element={
          <RequireAuth>
            <DailyPage />
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
        path="/trail"
        element={
          <RequireAuth>
            <TrailPage />
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
      <Route
        path="/profile"
        element={
          <RequireAuth>
            <ProfilePage />
          </RequireAuth>
        }
      />
      {/* Public: works signed out. */}
      <Route path="/u/:handle" element={<PublicProfilePage />} />
      <Route path="/u/:handle/notes/:id" element={<PublicNotePage />} />
      <Route path="/people" element={<PeoplePage />} />
      {/* Community articles: reading is public, writing needs an account. */}
      <Route path="/articles" element={<ArticlesPage />} />
      <Route
        path="/articles/new"
        element={
          <RequireAuth>
            <ArticleEditorPage />
          </RequireAuth>
        }
      />
      <Route
        path="/articles/:id/edit"
        element={
          <RequireAuth>
            <ArticleEditorPage />
          </RequireAuth>
        }
      />
      <Route path="/articles/:id" element={<ArticlePage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

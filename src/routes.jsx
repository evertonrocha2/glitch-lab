import { Navigate, Route, Routes, useLocation, useParams } from 'react-router'
import { useAuth } from './lib/auth/AuthProvider.jsx'
import ArticleEditorPage from './pages/ArticleEditorPage.jsx'
import ArticlePage from './pages/ArticlePage.jsx'
import ArticlesPage from './pages/ArticlesPage.jsx'
import BoardPage from './pages/BoardPage.jsx'
import DailyPage from './pages/DailyPage.jsx'
import DuelLobbyPage from './pages/DuelLobbyPage.jsx'
import DuelPage from './pages/DuelPage.jsx'
import GlitchdlePage from './pages/GlitchdlePage.jsx'
import GymPage from './pages/GymPage.jsx'
import HuntPage from './pages/HuntPage.jsx'
import InterrogationPage from './pages/InterrogationPage.jsx'
import LandingPage from './pages/LandingPage.jsx'
import LoginPage from './pages/LoginPage.jsx'
import NotesPage from './pages/NotesPage.jsx'
import ProfilePage from './pages/ProfilePage.jsx'
import ProgressPage from './pages/ProgressPage.jsx'
import PublicProfilePage from './pages/PublicProfilePage.jsx'
import PeoplePage from './pages/PeoplePage.jsx'
import PublicNotePage from './pages/PublicNotePage.jsx'
import TrailPage from './pages/TrailPage.jsx'
import EventEditorPage from './pages/EventEditorPage.jsx'
import EventPage from './pages/EventPage.jsx'
import EventsPage from './pages/EventsPage.jsx'

export function RequireAuth({ children }) {
  const { user } = useAuth()
  const location = useLocation()
  if (!user) return <Navigate to={`/login?next=${encodeURIComponent(location.pathname)}`} replace />
  return children
}

// A top-level "@handle" goes to that profile; anything else unknown goes home.
function AtHandle() {
  const { slug } = useParams()
  return <Navigate to={slug.startsWith('@') ? `/u/${slug.slice(1)}` : '/'} replace />
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
        path="/interrogate/:caseId"
        element={
          <RequireAuth>
            <InterrogationPage />
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
      <Route
        path="/glitchdle"
        element={
          <RequireAuth>
            <GlitchdlePage />
          </RequireAuth>
        }
      />
      <Route
        path="/hunt"
        element={
          <RequireAuth>
            <HuntPage />
          </RequireAuth>
        }
      />
      <Route
        path="/duel"
        element={
          <RequireAuth>
            <DuelLobbyPage />
          </RequireAuth>
        }
      />
      <Route
        path="/duel/:id"
        element={
          <RequireAuth>
            <DuelPage />
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
      {/* "/@ada" is the short link people type: it opens /u/ada. */}
      <Route path="/:slug" element={<AtHandle />} />
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
      {/* Community events: browsing is public, creating, joining and voting need an account. */}
      <Route path="/events" element={<EventsPage />} />
      <Route
        path="/events/new"
        element={
          <RequireAuth>
            <EventEditorPage />
          </RequireAuth>
        }
      />
      <Route
        path="/events/:id/edit"
        element={
          <RequireAuth>
            <EventEditorPage />
          </RequireAuth>
        }
      />
      <Route path="/events/:id" element={<EventPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

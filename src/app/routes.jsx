import { Navigate, Route, Routes, useLocation, useParams } from 'react-router'
import { useAuth } from '../lib/auth/auth-provider.jsx'
import ArticleEditorPage from '../pages/article-editor-page/article-editor-page.jsx'
import ArticlePage from '../pages/article-page/article-page.jsx'
import ArticlesPage from '../pages/articles-page/articles-page.jsx'
import BoardPage from '../pages/board-page/board-page.jsx'
import DailyPage from '../pages/daily-page/daily-page.jsx'
import DuelLobbyPage from '../pages/duel-lobby-page/duel-lobby-page.jsx'
import DuelPage from '../pages/duel-page/duel-page.jsx'
import GlitchdlePage from '../pages/glitchdle-page/glitchdle-page.jsx'
import GymPage from '../pages/gym-page/gym-page.jsx'
import HuntPage from '../pages/hunt-page/hunt-page.jsx'
import InterrogationPage from '../pages/interrogation-page/interrogation-page.jsx'
import LandingPage from '../pages/landing-page/landing-page.jsx'
import LoginPage from '../pages/login-page/login-page.jsx'
import NotesPage from '../pages/notes-page/notes-page.jsx'
import ProfilePage from '../pages/profile-page/profile-page.jsx'
import ProgressPage from '../pages/progress-page/progress-page.jsx'
import PublicProfilePage from '../pages/public-profile-page/public-profile-page.jsx'
import PeoplePage from '../pages/people-page/people-page.jsx'
import PublicNotePage from '../pages/public-note-page/public-note-page.jsx'
import TrailPage from '../pages/trail-page/trail-page.jsx'
import EventEditorPage from '../pages/event-editor-page/event-editor-page.jsx'
import EventPage from '../pages/event-page/event-page.jsx'
import EventsPage from '../pages/events-page/events-page.jsx'
import CommunitiesPage from '../pages/communities-page/communities-page.jsx'
import CommunityNewPage from '../pages/community-new-page/community-new-page.jsx'
import CommunityPage from '../pages/community-page/community-page.jsx'
import MessagesPage from '../pages/messages-page/messages-page.jsx'

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
      {/* Direct messages: the inbox and an open conversation on one route, so opening one keeps the list. */}
      <Route
        path="/messages/:id?"
        element={
          <RequireAuth>
            <MessagesPage />
          </RequireAuth>
        }
      />
      {/* Communities: reading is public, creating, joining and posting need an account. */}
      <Route path="/communities" element={<CommunitiesPage />} />
      <Route
        path="/communities/new"
        element={
          <RequireAuth>
            <CommunityNewPage />
          </RequireAuth>
        }
      />
      <Route path="/communities/:slug" element={<CommunityPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

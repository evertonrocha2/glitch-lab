import { Suspense } from 'react'
import { Navigate, Route, Routes, useLocation, useParams } from 'react-router'
import AppShell from '../components/layout/app-shell/app-shell.jsx'
import CommunityShell from '../components/layout/community-shell/community-shell.jsx'
import { useAuth } from '../lib/auth/auth-provider.jsx'
import LandingPage from '../pages/landing-page/landing-page.jsx'
import LoginPage from '../pages/login-page/login-page.jsx'
import { pages } from './lazy-pages.js'

const {
  ArticleEditorPage,
  ArticlePage,
  ArticlesPage,
  BoardPage,
  DailyPage,
  DuelLobbyPage,
  DuelPage,
  EventEditorPage,
  EventPage,
  EventsPage,
  GlitchdlePage,
  GymPage,
  HuntPage,
  InterrogationPage,
  NotesPage,
  PeoplePage,
  ProfilePage,
  ProgressPage,
  PublicNotePage,
  PublicProfilePage,
  TrailPage,
} = pages

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

// Shown only on a first load while that page's chunk arrives (moving between pages is a transition,
// so the old page stays until the new one is ready): the page's own frame, without its content.
function PageLoading() {
  const { user } = useAuth()
  const { pathname } = useLocation()
  if (pathname.startsWith('/u/')) return null
  if (/^\/(articles|events|people)(\/|$)/.test(pathname)) return <CommunityShell />
  return user ? <AppShell /> : null
}

export function AppRoutes() {
  return (
    <Suspense fallback={<PageLoading />}>
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
    </Suspense>
  )
}

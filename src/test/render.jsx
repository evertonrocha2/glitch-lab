import { render, screen } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router'
import { AssistantProvider } from '../lib/assistant/AssistantProvider.jsx'
import { AuthProvider } from '../lib/auth/AuthProvider.jsx'
import { ProgressProvider } from '../lib/progress/ProgressProvider.jsx'
import { StudyTimerProvider } from '../lib/timer/StudyTimerProvider.jsx'
import { AppRoutes } from '../routes.jsx'

function LocationProbe() {
  const location = useLocation()
  return <output data-testid="location">{location.pathname + location.search}</output>
}

// Renders the whole app at `path`, already signed in as `user` (token "token-<user>") when given.
export function renderAt(path, { user } = {}) {
  if (user) {
    const session = { token: `token-${user}`, user: { id: user, email: `${user}@test.dev`, isDemo: false } }
    localStorage.setItem('gd:session', JSON.stringify(session))
  }
  return render(
    <AuthProvider>
      <ProgressProvider>
        <StudyTimerProvider>
          <AssistantProvider>
            <MemoryRouter initialEntries={[path]}>
              <AppRoutes />
              <LocationProbe />
            </MemoryRouter>
          </AssistantProvider>
        </StudyTimerProvider>
      </ProgressProvider>
    </AuthProvider>,
  )
}

export const currentLocation = () => screen.getByTestId('location').textContent

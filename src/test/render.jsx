import { render, screen } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router'
import { AssistantProvider } from '../lib/assistant/assistant-provider.jsx'
import { AuthProvider } from '../lib/auth/auth-provider.jsx'
import { MessageAlertsProvider } from '../lib/chat/message-alerts.jsx'
import { I18nProvider } from '../lib/i18n/I18nProvider.jsx'
import { ProgressProvider } from '../lib/progress/progress-provider.jsx'
import { StudyTimerProvider } from '../lib/timer/study-timer-provider.jsx'
import { AppRoutes } from '../app/routes.jsx'

function LocationProbe() {
  const location = useLocation()
  return <output data-testid="location">{location.pathname + location.search}</output>
}

// Renders the whole app at `path`, already signed in as `user` (token "token-<user>") when given.
// Tests speak English unless they ask for another `locale`. `messageAlerts` adds the DM toasts
// provider (it checks the inbox, so only tests that mock listConversations turn it on).
export function renderAt(path, { user, locale = 'en', messageAlerts = false } = {}) {
  if (user) {
    const session = { token: `token-${user}`, user: { id: user, email: `${user}@test.dev`, isDemo: false } }
    localStorage.setItem('gd:session', JSON.stringify(session))
  }
  const app = (
    <StudyTimerProvider>
      <AssistantProvider>
        <MemoryRouter initialEntries={[path]}>
          <AppRoutes />
          <LocationProbe />
        </MemoryRouter>
      </AssistantProvider>
    </StudyTimerProvider>
  )
  return render(
    <I18nProvider locale={locale}>
    <AuthProvider>
      <ProgressProvider>{messageAlerts ? <MessageAlertsProvider>{app}</MessageAlertsProvider> : app}</ProgressProvider>
    </AuthProvider>
    </I18nProvider>,
  )
}

export const currentLocation = () => screen.getByTestId('location').textContent

import { BrowserRouter } from 'react-router'
import { AssistantProvider } from '../lib/assistant/assistant-provider.jsx'
import { AuthProvider } from '../lib/auth/auth-provider.jsx'
import { I18nProvider } from '../lib/i18n/I18nProvider.jsx'
import { ProgressProvider } from '../lib/progress/progress-provider.jsx'
import { StudyTimerProvider } from '../lib/timer/study-timer-provider.jsx'
import { AppRoutes } from './routes.jsx'

export default function App() {
  return (
    <I18nProvider>
      <AuthProvider>
      <ProgressProvider>
        <StudyTimerProvider>
          <AssistantProvider>
            <BrowserRouter>
              <AppRoutes />
            </BrowserRouter>
          </AssistantProvider>
        </StudyTimerProvider>
      </ProgressProvider>
      </AuthProvider>
    </I18nProvider>
  )
}

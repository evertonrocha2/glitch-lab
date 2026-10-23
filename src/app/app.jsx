import { BrowserRouter } from 'react-router'
import { AssistantProvider } from '../lib/assistant/AssistantProvider.jsx'
import { AuthProvider } from '../lib/auth/AuthProvider.jsx'
import { I18nProvider } from '../lib/i18n/I18nProvider.jsx'
import { ProgressProvider } from '../lib/progress/ProgressProvider.jsx'
import { StudyTimerProvider } from '../lib/timer/StudyTimerProvider.jsx'
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

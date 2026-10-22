import { BrowserRouter } from 'react-router'
import { AssistantProvider } from './lib/assistant/AssistantProvider.jsx'
import { AuthProvider } from './lib/auth/AuthProvider.jsx'
import { ProgressProvider } from './lib/progress/ProgressProvider.jsx'
import { StudyTimerProvider } from './lib/timer/StudyTimerProvider.jsx'
import { AppRoutes } from './routes.jsx'

export default function App() {
  return (
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
  )
}

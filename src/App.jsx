import { BrowserRouter } from 'react-router'
import { AuthProvider } from './lib/auth/AuthProvider.jsx'
import { ProgressProvider } from './lib/progress/ProgressProvider.jsx'
import { StudyTimerProvider } from './lib/timer/StudyTimerProvider.jsx'
import { AppRoutes } from './routes.jsx'

export default function App() {
  return (
    <AuthProvider>
      <ProgressProvider>
        <StudyTimerProvider>
          <BrowserRouter>
            <AppRoutes />
          </BrowserRouter>
        </StudyTimerProvider>
      </ProgressProvider>
    </AuthProvider>
  )
}

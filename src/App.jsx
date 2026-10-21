import { BrowserRouter } from 'react-router'
import { AuthProvider } from './lib/auth/AuthProvider.jsx'
import { AppRoutes } from './routes.jsx'

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  )
}

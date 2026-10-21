import { render, screen } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router'
import { AuthProvider } from '../lib/auth/AuthProvider.jsx'
import { AppRoutes } from '../routes.jsx'

function LocationProbe() {
  const location = useLocation()
  return <output data-testid="location">{location.pathname + location.search}</output>
}

// Renders the whole app at `path`, already signed in (dev auth) as `user` when given.
export function renderAt(path, { user } = {}) {
  if (user) localStorage.setItem('gd:dev-user', JSON.stringify({ id: user, email: `${user}@dev.local` }))
  return render(
    <AuthProvider>
      <MemoryRouter initialEntries={[path]}>
        <AppRoutes />
        <LocationProbe />
      </MemoryRouter>
    </AuthProvider>,
  )
}

export const currentLocation = () => screen.getByTestId('location').textContent

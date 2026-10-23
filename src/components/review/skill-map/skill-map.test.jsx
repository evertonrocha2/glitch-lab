import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import { beforeEach, expect, it, vi } from 'vitest'
import { skillMap } from '../../../../shared/skills.js'
import { startChallenge } from '../../../lib/api.js'
import { AuthProvider } from '../../../lib/auth/AuthProvider.jsx'
import { I18nProvider } from '../../../lib/i18n/I18nProvider.jsx'
import SkillMap from './skill-map.jsx'

vi.mock('../../../lib/api.js', () => ({
  AuthError: class AuthError extends Error {},
  startChallenge: vi.fn(),
}))

function renderMap(skills, locale = 'en') {
  localStorage.setItem('gd:session', JSON.stringify({ token: 'token-alice', user: { id: 'alice', email: 'alice@test.dev', isDemo: false } }))
  return render(
    <I18nProvider locale={locale}>
      <AuthProvider>
        <MemoryRouter initialEntries={['/progress']}>
          <Routes>
            <Route path="/progress" element={<SkillMap skills={skills} />} />
            <Route path="/gym/:id" element={<p>Gym page</p>} />
            <Route path="/daily" element={<p>Daily page</p>} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    </I18nProvider>,
  )
}

const SKILLS = skillMap({
  cases: [
    { id: 'c1', concept: 'off-by-one', status: 'solved' },
    { id: 'c2', concept: 'key-error', status: 'new' },
  ],
  challenges: [{ caseId: 'c1', status: 'passed' }],
  items: [
    { concept: 'off-by-one', box: 3, dueDay: '2026-10-29' },
    { concept: 'key-error', box: 1, dueDay: '2026-10-23' },
  ],
})

beforeEach(() => {
  vi.mocked(startChallenge).mockReset()
})

it('draws mastery per bug type with a table for screen readers', () => {
  renderMap(SKILLS)
  expect(screen.getByRole('heading', { name: 'Skill map' })).toBeInTheDocument()
  expect(screen.getByRole('img', { name: 'Skill map: 2 of 11 bug types met, 25% average mastery.' })).toBeInTheDocument()
  const table = screen.getByRole('table', { name: 'Mastery per bug type' })
  const offByOne = within(table).getByRole('row', { name: /Off by one/ })
  // Box 3 is half the review half (25) plus 15 solved and 10 passed.
  expect(within(offByOne).getAllByRole('cell').map((cell) => cell.textContent)).toEqual(['50%', '3', '1', '1'])
  const unmet = within(table).getByRole('row', { name: /Async and await/ })
  expect(within(unmet).getAllByRole('cell')[0]).toHaveTextContent('Not met yet')
})

it('calls out the weakest bug type and trains it in the gym', async () => {
  const user = userEvent.setup()
  vi.mocked(startChallenge).mockResolvedValue({ id: 'ch9' })
  renderMap(SKILLS)
  expect(screen.getByText('Your weakest spot is Missing key, at 0%.')).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Train' }))
  expect(startChallenge).toHaveBeenCalledWith('c2', 'token-alice')
  expect(await screen.findByText('Gym page')).toBeInTheDocument()
})

it('sends a weakest bug type without a case of its own to the daily page, in Portuguese', async () => {
  const user = userEvent.setup()
  renderMap(skillMap({ puzzleConcepts: ['wrong-comparison'] }), 'pt-BR')
  expect(screen.getByRole('heading', { name: 'Mapa de habilidades' })).toBeInTheDocument()
  await user.click(screen.getByRole('link', { name: 'Treinar' }))
  expect(await screen.findByText('Daily page')).toBeInTheDocument()
})

it('asks for a first case when nothing was met', () => {
  renderMap(skillMap({}))
  expect(screen.getByText('Investigate your first error to start your map.')).toBeInTheDocument()
  expect(screen.queryByRole('img')).not.toBeInTheDocument()
})

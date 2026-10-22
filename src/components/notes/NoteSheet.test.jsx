import { render, screen } from '@testing-library/react'
import { expect, it } from 'vitest'
import NoteSheet from './NoteSheet.jsx'

const analysis = { explicacao: 'a', causa: 'b', correcao: 'c', exercicio: { enunciado: 'd', resposta: 'e' } }
const CASES = [
  { id: 'c1', status: 'training', passedCount: 1, error: "TypeError: Cannot read properties of undefined (reading 'length')", concept: 'undefined-access', language: 'javascript', analysis },
]
const NOTE = {
  id: 'n1',
  title: 'Undefined again',
  blocks: [
    { id: 'b1', type: 'heading', text: 'Pattern' },
    { id: 'b2', type: 'text', text: 'Check before reading.\nEvery time.' },
    { id: 'b3', type: 'text', text: '  ' },
    { id: 'b4', type: 'todo', text: 'Use ?.', done: true },
    { id: 'b5', type: 'todo', text: 'Second pass', done: false },
    { id: 'b6', type: 'case', caseId: 'c1' },
    { id: 'b7', type: 'case', caseId: 'gone' },
  ],
}

it('lays out the whole note as a printable sheet', () => {
  const { container } = render(<NoteSheet note={NOTE} cases={CASES} date="Oct 22, 2026" />)
  expect(screen.getByText('Glitch Detective')).toBeInTheDocument()
  expect(screen.getByText('Exported Oct 22, 2026')).toBeInTheDocument()
  expect(screen.getByRole('heading', { level: 1, name: 'Undefined again' })).toBeInTheDocument()
  expect(screen.getByRole('heading', { level: 2, name: 'Pattern' })).toBeInTheDocument()
  expect(screen.getByText(/Check before reading\./)).toHaveTextContent('Check before reading. Every time.')
  expect(screen.getByText('Use ?.').closest('li')).toHaveAttribute('data-done', 'true')
  expect(screen.getByText('Second pass').closest('li')).toHaveAttribute('data-done', 'false')
  // The case card: bug type, language, progress, error type and message.
  expect(screen.getByText('Reading undefined')).toBeInTheDocument()
  expect(screen.getByText('javascript')).toBeInTheDocument()
  expect(screen.getByText('Training · 1/2')).toBeInTheDocument()
  expect(screen.getByText('TypeError')).toBeInTheDocument()
  expect(screen.getByText("Cannot read properties of undefined (reading 'length')")).toBeInTheDocument()
  expect(screen.getByText('This case is not on your board anymore.')).toBeInTheDocument()
  // A picture of the note: nothing to click or type in.
  expect(container.querySelectorAll('a, button, input, textarea')).toHaveLength(0)
  // Empty text blocks are left out; every block marks where a page may break.
  expect(container.querySelectorAll('[data-sheet-block]')).toHaveLength(6)
})

it('names an untitled note', () => {
  render(<NoteSheet note={{ ...NOTE, title: '', blocks: [] }} cases={[]} date="Oct 22, 2026" />)
  expect(screen.getByRole('heading', { level: 1, name: 'Untitled' })).toBeInTheDocument()
})

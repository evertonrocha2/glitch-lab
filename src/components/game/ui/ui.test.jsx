import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { BY_R } from '../hero/palette.js'
import Bar from './bar.jsx'
import Frame, { Chip, SectionTitle } from './frame.jsx'
import { RARITY_TRIM, TONES, UI } from './tokens.js'

describe('tokens', () => {
  it('holds the spec colors and one tone per frame kind', () => {
    expect(UI.ink).toBe('#120c22')
    expect(UI.gold).toBe('#f2c14e')
    expect(Object.keys(TONES)).toEqual(['panel', 'raised', 'inset', 'gold'])
  })

  it('takes the rarity trims from the hero palette', () => {
    for (const rarity of Object.keys(BY_R.trim)) expect(RARITY_TRIM[rarity]).toBe(BY_R.trim[rarity][2])
  })
})

describe('Frame', () => {
  it('renders its children in a div by default, with the panel tone', () => {
    render(<Frame>inside</Frame>)
    const box = screen.getByText('inside')
    expect(box.tagName).toBe('DIV')
    expect(box).toHaveAttribute('data-tone', 'panel')
  })

  it('renders the element it is given and passes props through', () => {
    const onClick = vi.fn()
    render(
      <Frame as="button" type="button" tone="raised" aria-label="Open" onClick={onClick} className="p-2">
        <span>label</span>
      </Frame>,
    )
    const button = screen.getByRole('button', { name: 'Open' })
    expect(button).toHaveAttribute('data-tone', 'raised')
    expect(button).toHaveClass('p-2')
    expect(button).toContainElement(screen.getByText('label'))
    fireEvent.click(button)
    expect(onClick).toHaveBeenCalledOnce()
  })

  it('falls back to the panel tone for an unknown one', () => {
    render(<Frame tone="nope">x</Frame>)
    expect(screen.getByText('x')).toHaveAttribute('data-tone', 'panel')
  })
})

describe('Chip and SectionTitle', () => {
  it('Chip shows its text', () => {
    render(<Chip tone="gold">Q</Chip>)
    expect(screen.getByText('Q')).toBeInTheDocument()
  })

  it('SectionTitle is a heading of the given level', () => {
    render(<SectionTitle level={4}>Stats</SectionTitle>)
    expect(screen.getByRole('heading', { level: 4, name: 'Stats' })).toBeInTheDocument()
  })
})

describe('Bar', () => {
  it('is a meter with its value, bounds and label', () => {
    render(<Bar value={30} max={120} label="Life" color="#e84a5f" />)
    const meter = screen.getByRole('meter', { name: 'Life' })
    expect(meter).toHaveAttribute('aria-valuenow', '30')
    expect(meter).toHaveAttribute('aria-valuemin', '0')
    expect(meter).toHaveAttribute('aria-valuemax', '120')
    expect(meter).toHaveTextContent('30 / 120')
  })

  it('shows a custom text and clamps the value into its bounds', () => {
    render(<Bar value={500} max={100} label="XP" text="XP 500" />)
    const meter = screen.getByRole('meter', { name: 'XP' })
    expect(meter).toHaveAttribute('aria-valuenow', '100')
    expect(meter).toHaveTextContent('XP 500')
  })

  it('survives a zero max', () => {
    render(<Bar value={3} max={0} label="Empty" />)
    expect(screen.getByRole('meter', { name: 'Empty' })).toHaveAttribute('aria-valuenow', '0')
  })

  it('draws segment dividers and a tick when asked', () => {
    const { container } = render(<Bar value={2} max={4} label="Seg" segments={4} tick={3} />)
    expect(container.querySelectorAll('[data-part="divider"]')).toHaveLength(3)
    expect(container.querySelector('[data-part="tick"]')).not.toBeNull()
  })
})

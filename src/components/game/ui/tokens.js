import { BY_R } from '../hero/palette.js'

// The in-game UI colors (spec, fase 1b), in the site's Ardósia slate. Everything in the game's
// panels, HUD and dialogs reads from here, so the screen stays one palette with the hero.
export const UI = {
  ink: '#0e1116',
  panel: '#20252f',
  raised: '#29303c',
  inset: '#171b23',
  bevelLight: '#363e4c',
  bevelDark: '#0e1116',
  text: '#e8eaee',
  muted: '#b0b6c1',
  gold: '#f2c14e',
  goldDark: '#9a6a1c',
  danger: '#ff5a6e',
  ok: '#6fe39a',
}

// A Frame's fill (bg) and bevel: hi is the top-left edge, lo the bottom-right one. Inset swaps them
// so the box reads as sunk into the one around it.
export const TONES = {
  panel: { bg: UI.panel, hi: UI.bevelLight, lo: UI.bevelDark },
  raised: { bg: UI.raised, hi: '#4e5869', lo: UI.bevelDark },
  inset: { bg: UI.inset, hi: UI.bevelDark, lo: '#2c3340' },
  gold: { bg: '#2e2b28', hi: UI.gold, lo: UI.goldDark },
}

// The light trim of each rarity, the same color the hero's gear wears.
export const RARITY_TRIM = Object.fromEntries(Object.entries(BY_R.trim).map(([rarity, ramp]) => [rarity, ramp[2]]))

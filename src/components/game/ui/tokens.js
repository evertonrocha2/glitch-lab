import { BY_R } from '../hero/palette.js'

// The in-game UI colors (spec, fase 1b). Everything in the game's panels, HUD and dialogs reads
// from here, so the screen stays one palette with the hero.
export const UI = {
  ink: '#120c22',
  panel: '#1b1433',
  raised: '#241c44',
  inset: '#100c20',
  bevelLight: '#3e3170',
  bevelDark: '#0a0818',
  text: '#e9e4ff',
  muted: '#a89fd0',
  gold: '#f2c14e',
  goldDark: '#9a6a1c',
  danger: '#ff5a6e',
  ok: '#6fe39a',
}

// A Frame's fill (bg) and bevel: hi is the top-left edge, lo the bottom-right one. Inset swaps them
// so the box reads as sunk into the one around it.
export const TONES = {
  panel: { bg: UI.panel, hi: UI.bevelLight, lo: UI.bevelDark },
  raised: { bg: UI.raised, hi: '#574a96', lo: UI.bevelDark },
  inset: { bg: UI.inset, hi: UI.bevelDark, lo: '#2a2250' },
  gold: { bg: '#2a1f2c', hi: UI.gold, lo: UI.goldDark },
}

// The light trim of each rarity, the same color the hero's gear wears.
export const RARITY_TRIM = Object.fromEntries(Object.entries(BY_R.trim).map(([rarity, ramp]) => [rarity, ramp[2]]))

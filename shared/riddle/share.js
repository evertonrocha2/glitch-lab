import { SLOTS } from './slots.js'

// The result a player pastes in a chat: no answers, one line per board, the last rows of a
// classic board, the streak and a link. Words come from `t` (the app's translator), so it reads
// in the player's language.

const SQUARES = { match: '\u{1F7EA}', partial: '\u{1F7E8}', miss: '⬜' }
export const SHARE_ICONS = { classic: '\u{1F9E9}', error: '⚠️', snippet: '✂️', frameworks: '\u{1F9F1}', databases: '\u{1F5C4}️' }
// Only the end of a board: four rows say how it went without a wall of squares.
export const SHARE_ROWS = 4

// One board's line. state: { solved, over, guesses }.
function boardStatus(t, state) {
  if (state?.solved) return t('app.glitchdle.share.solved', { count: state.guesses })
  if (state?.over) return t('app.glitchdle.share.missed')
  if (state?.guesses) return t('app.glitchdle.share.playing', { count: state.guesses })
  return t('app.glitchdle.share.notPlayed')
}

// number: the game number; date: its day as the reader writes it ("23/10", "Oct 23");
// boards: { slot: { solved, over, guesses } }; rows: the shared board's grid, first guess first;
// streak: perfect days in a row; host: where to play, without https://.
export function shareText({ t, number, date, boards, rows = [], streak = 0, host, name }) {
  const lines = [`\u{1F50D} Glitchdle #${number} (${date})`, '']
  for (const slot of SLOTS) lines.push(`${SHARE_ICONS[slot]} ${name(slot)}: ${boardStatus(t, boards[slot])}`)
  if (rows.length) {
    lines.push('')
    for (const row of rows.slice(-SHARE_ROWS)) lines.push(row.map((status) => SQUARES[status]).join(''))
    if (rows.length > SHARE_ROWS) lines.push(t('app.glitchdle.share.earlier', { count: rows.length - SHARE_ROWS }))
  }
  lines.push('')
  if (streak >= 2) lines.push(`\u{1F525} ${t('app.glitchdle.share.streak', { count: streak })}`)
  lines.push(t('app.glitchdle.share.cta', { url: `${host}/glitchdle` }))
  return lines.join('\n')
}

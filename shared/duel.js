// Duel: a 1v1 quiz race. The rules both the server and the browser read.
// The server owns the clock: every time below is measured on the server, never in the browser.

export const DUEL_ROUNDS = 5
// The 3-2-1 before the first round.
export const COUNTDOWN_MS = 3_000
// How long a round stays open. It closes early once both players have answered.
export const ROUND_MS = 15_000
// The pause after a round closes, to show the right answer before the next one opens.
export const REVEAL_MS = 3_000
// With nobody to play after this long, the waiting room offers the Glitch Bot.
export const BOT_OFFER_MS = 20_000
// Forfeit rule: during an active duel, a player whose page hasn't checked in for this long loses.
// Players who stay but don't answer simply score 0 on those rounds.
export const STALE_MS = 30_000

// A round: 0 when wrong, voided (left the tab) or not answered; otherwise 100 plus up to 100 for
// speed, falling in a straight line from an instant answer to the last moment.
export const BASE_POINTS = 100
export const SPEED_POINTS = 100
export function roundPoints({ correct, ms, left = false }) {
  if (!correct || left || ms == null) return 0
  const remaining = Math.min(ROUND_MS, Math.max(0, ROUND_MS - ms))
  return BASE_POINTS + Math.round((SPEED_POINTS * remaining) / ROUND_MS)
}

// Elo: everyone starts at 1000; K is how far one game can move a rating.
export const START_RATING = 1000
export const ELO_K = 32
// score: 1 for a win, 0.5 for a draw, 0 for a loss. Returns the new rating, rounded.
export function eloRating(rating, opponent, score) {
  const expected = 1 / (1 + 10 ** ((opponent - rating) / 400))
  return Math.round(rating + ELO_K * (score - expected))
}

// XP per finished duel. A forfeit (you left) pays nothing. Games against the Glitch Bot pay half,
// and only the first few a day count (no farming); duels against people are capped too.
export const DUEL_XP = { win: 40, draw: 25, loss: 10, forfeit: 0 }
export const BOT_XP_PER_DAY = 3
export const HUMAN_XP_PER_DAY = 10
// The speed-demon badge: a right answer this fast.
export const SPEED_DEMON_MS = 2_000
// A day with duels counts at most this many times on the activity graph.
export const MAX_DUEL_ACTIVITY = 3

// results: [{ day, outcome: 'win' | 'draw' | 'loss' | 'forfeit', vsBot, fastestMs }], one per
// finished duel. Returns { xp, played, wins, humanWins, fastestMs }.
export function duelSummary(results = []) {
  const perDay = new Map()
  let xp = 0
  for (const item of results) {
    const slot = `${item.day}:${item.vsBot ? 'bot' : 'human'}`
    const count = perDay.get(slot) ?? 0
    perDay.set(slot, count + 1)
    if (count >= (item.vsBot ? BOT_XP_PER_DAY : HUMAN_XP_PER_DAY)) continue
    const full = DUEL_XP[item.outcome] ?? 0
    xp += item.vsBot ? Math.floor(full / 2) : full
  }
  const fastest = results.map((item) => item.fastestMs).filter((ms) => typeof ms === 'number')
  return {
    xp,
    played: results.length,
    wins: results.filter((item) => item.outcome === 'win').length,
    humanWins: results.filter((item) => item.outcome === 'win' && !item.vsBot).length,
    fastestMs: fastest.length ? Math.min(...fastest) : null,
  }
}

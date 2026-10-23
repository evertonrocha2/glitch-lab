// Small helpers the duel pages share. The rules themselves live in shared/duel.js.

// A player's name as the page shows it: "You", the bot, a public name, or "Anonymous player".
export function playerName(t, player, { youLabel = true } = {}) {
  if (!player) return ''
  if (player.you && youLabel) return t('duel.you')
  if (player.bot) return t('duel.bot')
  return player.handle ? player.name : t('player.anonymous')
}

// m:ss, for how long the waiting room has waited.
export function formatElapsed(ms) {
  const seconds = Math.max(0, Math.floor(ms / 1000))
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}

// Whole seconds left until `iso` (rounded up, never below 0), on the server's clock.
export const secondsUntil = (iso, now) => Math.max(0, Math.ceil((Date.parse(iso) - now) / 1000))

// One decimal in the reader's language: 3.2 or 3,2.
export const formatSeconds = (ms, locale = 'en') =>
  new Intl.NumberFormat(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(Math.round(ms / 100) / 10)

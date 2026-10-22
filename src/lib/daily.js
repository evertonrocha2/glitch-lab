const pad = (value) => String(value).padStart(2, '0')

// "11:59:30" for the next daily set; "3d 12h" for a global challenge days away from its end.
export function formatCountdown(ms) {
  const seconds = Math.max(0, Math.floor(ms / 1000))
  const days = Math.floor(seconds / 86_400)
  if (days >= 1) return `${days}d ${Math.floor((seconds % 86_400) / 3600)}h`
  return `${Math.floor(seconds / 3600)}:${pad(Math.floor((seconds % 3600) / 60))}:${pad(seconds % 60)}`
}

// How long a solve took, from starting the puzzle to passing it.
export function formatSolveTime(seconds) {
  if (seconds < 60) return `${seconds}s`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${pad(seconds % 60)}s`
  return `${Math.floor(seconds / 3600)}h ${pad(Math.floor((seconds % 3600) / 60))}m`
}

const LANGUAGE_NAMES = { javascript: 'JavaScript', typescript: 'TypeScript', python: 'Python', java: 'Java' }

export const languageName = (id) => LANGUAGE_NAMES[id] ?? id

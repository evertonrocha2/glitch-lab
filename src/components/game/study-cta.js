// Where the game's "study to get stronger" box sends the student: today's daily puzzle first, then
// today's line hunt, then ENEM practice (only in the pt-BR UI, where ENEM exists), else the board.
// doneToday: { daily, hunt } (true when that one is finished today; unknown counts as not done).
export function studyHref({ locale, doneToday = {} } = {}) {
  if (!doneToday.daily) return '/daily'
  if (!doneToday.hunt) return '/hunt'
  if (locale === 'pt-BR') return '/exams/enem'
  return '/board'
}

// The study pages whose right answers count as acertos (shared/game/fuel.js studyLedger): the daily
// puzzle and its spaced review, the line hunt, ENEM questions (pt-BR only), bug fixes from the board
// (gym included), Glitchdle and duels. The study window's switcher lists them in this order.
const STUDY_PAGES = [
  { id: 'daily', href: '/daily' },
  { id: 'hunt', href: '/hunt' },
  { id: 'enem', href: '/exams/enem', locale: 'pt-BR' },
  { id: 'board', href: '/board' },
  { id: 'glitchdle', href: '/glitchdle' },
  { id: 'duel', href: '/duel' },
]

export const studyPages = (locale) => STUDY_PAGES.filter((page) => !page.locale || page.locale === locale)

// The listed page a study link opens (its path, or a page under it), else null.
export function studyPageOf(href, locale) {
  const path = href.split('?')[0]
  return studyPages(locale).find((page) => path === page.href || path.startsWith(`${page.href}/`)) ?? null
}

// Where the game's "study to get stronger" box sends the student: today's daily puzzle first, then
// today's line hunt, then ENEM practice (only in the pt-BR UI, where ENEM exists), else the board.
// doneToday: { daily, hunt } (true when that one is finished today; unknown counts as not done).
export function studyHref({ locale, doneToday = {} } = {}) {
  if (!doneToday.daily) return '/daily'
  if (!doneToday.hunt) return '/hunt'
  if (locale === 'pt-BR') return '/exams/enem'
  return '/board'
}

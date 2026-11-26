// The ENEM lessons live in their own chunk (shared/exams/lessons/index.js): every page that needs
// them shares one load. A failed load (offline) is forgotten, so the next call tries again.
let pending = null

export function loadLessons() {
  pending ??= import('../../../shared/exams/lessons/index.js').catch((err) => {
    pending = null
    throw err
  })
  return pending
}

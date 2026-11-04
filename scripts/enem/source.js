// ENEM questions from api.enem.dev: INEP's public exams already read into JSON (context in markdown,
// alternatives, the official answer, images). Only the data is used, never that project's code.
import { FOREIGN_LANGUAGE_TOPIC } from '../../shared/exams/enem.js'

export const API_BASE = 'https://api.enem.dev/v1'
// The last five exams the source has.
export const ENEM_YEARS = [2019, 2020, 2021, 2022, 2023]

const PAGE = 50
const PAUSE_MS = 300
const LETTERS = ['A', 'B', 'C', 'D', 'E']

const AREAS = { linguagens: 'linguagens', 'ciencias-humanas': 'humanas', 'ciencias-natureza': 'natureza', matematica: 'matematica' }

const pause = () => new Promise((done) => setTimeout(done, PAUSE_MS))

// Every question of one year, a page at a time, with a short pause between pages to go easy on a
// free service.
export async function fetchYear(year, { fetch = globalThis.fetch } = {}) {
  const questions = []
  for (let offset = 0; ; offset += PAGE) {
    if (offset > 0) await pause()
    const res = await fetch(`${API_BASE}/exams/${year}/questions?limit=${PAGE}&offset=${offset}`)
    if (!res.ok) throw new Error(`api.enem.dev answered ${res.status} for ${year} (offset ${offset})`)
    const page = await res.json()
    questions.push(...(page.questions ?? []))
    if (!page.metadata?.hasMore) return questions
  }
}

// A question as the store saves it, or null when it can't be used (no official answer, an area the
// app doesn't study). needsReview hides it from students until someone fixes it.
export function toQuestionRow(q) {
  const area = Object.hasOwn(AREAS, q.discipline) ? AREAS[q.discipline] : null
  const answer = LETTERS.includes(q.correctAlternative) ? q.correctAlternative : null
  if (!area || !answer) return null

  let context = q.context ?? ''
  for (const file of q.files ?? []) {
    if (typeof file === 'string' && !context.includes(file)) context = context ? `${context}\n\n![](${file})` : `![](${file})`
  }
  const alternatives = (q.alternatives ?? []).map((item) => ({ letter: item.letter, text: item.text ?? '', image: item.file ?? null }))
  const language = q.language ?? null
  const broken = `${context}${JSON.stringify(alternatives)}`.includes('broken-image')
  const unusable = alternatives.length !== 5 || alternatives.some((item) => !item.text.trim() && !item.image)

  return {
    exam: 'enem',
    year: q.year,
    number: q.index,
    area,
    language,
    topic: language ? (FOREIGN_LANGUAGE_TOPIC[language] ?? null) : null,
    context,
    statement: q.alternativesIntroduction ?? '',
    alternatives,
    answer,
    needsReview: broken || unusable,
    sourceKey: `enem.dev:${q.year}:${q.index}:${language ?? '-'}`,
  }
}
